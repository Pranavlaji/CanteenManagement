"use client";

import { UserProfile } from "@/lib/types";
import { auth, db, firebaseAuthEnabled } from "@/lib/firebase";
import {
  ConfirmationResult,
  RecaptchaVerifier,
  AuthError,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signOut as firebaseSignOut,
  updateProfile
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}

type AuthContextValue = {
  userProfile: UserProfile | null;
  authReady: boolean;
  authError: string | null;
  otpRequested: boolean;
  requestOtp: (profile: { name: string; phone: string }) => Promise<void>;
  confirmOtp: (code: string) => Promise<void>;
  cancelOtp: () => void;
  signInDemo: (profile: Omit<UserProfile, "uid" | "role"> & { role?: UserProfile["role"] }) => void;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STORAGE_KEY = "canteen.demo.user";

function normalizePhoneNumber(phone: string) {
  const trimmed = phone.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  return trimmed.replace(/\D/g, "");
}

function describeAuthError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }

  const authError = error as AuthError;
  switch (authError.code) {
    case "auth/invalid-phone-number":
      return "Use a full phone number with country code, like +919876543210.";
    case "auth/too-many-requests":
      return "Too many OTP attempts right now. Please wait a bit and try again.";
    case "auth/quota-exceeded":
      return "Firebase has hit the SMS quota for this project. Add a test number or try again later.";
    case "auth/captcha-check-failed":
      return "reCAPTCHA verification failed. Refresh the page and try again.";
    case "auth/invalid-verification-code":
      return "That OTP code is incorrect. Please try again.";
    case "auth/missing-phone-number":
      return "Enter your phone number to continue.";
    default:
      return authError.message || "Authentication failed. Please try again.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [otpRequested, setOtpRequested] = useState(false);
  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const recaptchaRef = useRef<RecaptchaVerifier | null>(null);
  const pendingProfileRef = useRef<{ name: string; phone: string } | null>(null);

  useEffect(() => {
    if (!firebaseAuthEnabled || !auth) {
      setAuthReady(true);
      try {
        const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
        if (raw) {
          setUserProfile(JSON.parse(raw) as UserProfile);
        }
      } catch {
        setUserProfile(null);
      }
      return;
    }

    return onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setUserProfile(null);
        setAuthReady(true);
        return;
      }

      try {
        const token = await getIdTokenResult(user, true);
        const role = (token.claims.role as UserProfile["role"] | undefined) ?? "student";
        const fallbackName = user.displayName?.trim() || "Student";
        let name = fallbackName;

        if (db) {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          const storedName = userDoc.exists() ? String(userDoc.get("name") || "").trim() : "";
          if (storedName) {
            name = storedName;
          }
        }

        setUserProfile({
          uid: user.uid,
          name,
          phone: user.phoneNumber ?? "",
          role
        });
      } catch {
        setAuthError("We couldn't load your account details. Try refreshing once.");
      } finally {
        setAuthReady(true);
      }
    });
  }, []);

  function ensureRecaptcha() {
    if (!auth) {
      throw new Error("Firebase auth is not configured.");
    }
    if (recaptchaRef.current) {
      return recaptchaRef.current;
    }
    const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible"
    });
    window.recaptchaVerifier = verifier;
    recaptchaRef.current = verifier;
    return verifier;
  }

  function resetRecaptcha() {
    if (recaptchaRef.current) {
      try { recaptchaRef.current.clear(); } catch { /* already cleared */ }
      recaptchaRef.current = null;
      window.recaptchaVerifier = undefined;
    }
  }

  async function requestOtp(profile: { name: string; phone: string }) {
    if (!firebaseAuthEnabled || !auth) {
      setAuthError("Firebase Auth is not configured in this environment yet.");
      return;
    }
    setAuthError(null);
    const name = profile.name.trim();
    const phone = normalizePhoneNumber(profile.phone);
    if (!name || !phone) {
      setAuthError("Enter both your name and phone number.");
      return;
    }

    if (!phone.startsWith("+")) {
      setAuthError("Use the phone number with country code, like +919876543210.");
      return;
    }

    try {
      const verifier = ensureRecaptcha();
      confirmationRef.current = await signInWithPhoneNumber(auth, phone, verifier);
      pendingProfileRef.current = { name, phone };
      setOtpRequested(true);
    } catch (error) {
      console.error("OTP request failed:", error);
      resetRecaptcha();
      setAuthError(describeAuthError(error));
    }
  }

  async function confirmOtp(code: string) {
    if (!confirmationRef.current) {
      setAuthError("Request an OTP first.");
      return;
    }
    const cleanCode = code.trim();
    if (!cleanCode) {
      setAuthError("Enter the OTP code to continue.");
      return;
    }

    setAuthError(null);
    try {
      const result = await confirmationRef.current.confirm(cleanCode);
      const pending = pendingProfileRef.current;
      if (pending) {
        if (result.user.displayName !== pending.name) {
          await updateProfile(result.user, { displayName: pending.name });
        }
        if (db) {
          await setDoc(doc(db, "users", result.user.uid), {
            name: pending.name,
            phone: result.user.phoneNumber ?? pending.phone,
            updatedAt: serverTimestamp()
          }, { merge: true });
        }
      }
      confirmationRef.current = null;
      pendingProfileRef.current = null;
      setOtpRequested(false);
    } catch (error) {
      setAuthError(describeAuthError(error));
    }
  }

  function cancelOtp() {
    confirmationRef.current = null;
    pendingProfileRef.current = null;
    setOtpRequested(false);
    setAuthError(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      userProfile,
      authReady,
      authError,
      otpRequested,
      requestOtp,
      confirmOtp,
      cancelOtp,
      signInDemo: ({ name, phone, role = "student" }) => {
        if (firebaseAuthEnabled) {
          setAuthError("Demo sign-in is disabled when Firebase Auth is enabled.");
          return;
        }
        const profile = {
          uid: `demo_${phone.replace(/\D/g, "") || "student"}`,
          name,
          phone,
          role
        };
        window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(profile));
        setUserProfile(profile);
      },
      signOut: async () => {
        setAuthError(null);
        confirmationRef.current = null;
        pendingProfileRef.current = null;
        setOtpRequested(false);
        if (firebaseAuthEnabled && auth) {
          await firebaseSignOut(auth);
          return;
        }
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setUserProfile(null);
      }
    }),
    [authError, authReady, otpRequested, userProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <div id="recaptcha-container" />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
