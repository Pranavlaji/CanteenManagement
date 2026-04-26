"use client";

import { UserProfile } from "@/lib/types";
import { auth, db, firebaseAuthEnabled } from "@/lib/firebase";
import {
  AuthError,
  GoogleAuthProvider,
  getIdTokenResult,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from "firebase/auth";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AuthContextValue = {
  userProfile: UserProfile | null;
  authReady: boolean;
  authError: string | null;
  signInWithGoogle: () => Promise<void>;
  signInWithCredentials: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_STORAGE_KEY = "canteen.demo.user";
const googleProvider = new GoogleAuthProvider();

function describeAuthError(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return error instanceof Error ? error.message : "Something went wrong. Please try again.";
  }

  const authError = error as AuthError;
  switch (authError.code) {
    case "auth/popup-closed-by-user":
      return "Sign-in popup was closed. Try again when you're ready.";
    case "auth/cancelled-popup-request":
      return null; // Not an error, just a duplicate popup
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/account-exists-with-different-credential":
      return "An account already exists with the same email but a different sign-in method.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Invalid username or password.";
    case "auth/too-many-requests":
      return "Too many sign-in attempts. Please wait a bit and try again.";
    case "auth/unauthorized-domain":
      return "This domain isn't authorized for sign-in. Add it in Firebase Console → Auth → Settings → Authorized domains.";
    default:
      return authError.message || "Authentication failed. Please try again.";
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
          email: user.email ?? "",
          phone: user.phoneNumber ?? "",
          role
        });
      } catch {
        // Still sign them in with basic info from Firebase Auth even if
        // Firestore or token enrichment fails
        setUserProfile({
          uid: user.uid,
          name: user.displayName?.trim() || "Student",
          email: user.email ?? "",
          phone: user.phoneNumber ?? "",
          role: "student"
        });
      } finally {
        setAuthReady(true);
      }
    });
  }, []);

  async function signInWithGoogle() {
    if (!firebaseAuthEnabled || !auth) {
      setAuthError("Firebase Auth is not configured in this environment.");
      return;
    }
    setAuthError(null);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Save/update user doc in Firestore
      if (db) {
        await setDoc(doc(db, "users", user.uid), {
          name: user.displayName ?? "Student",
          email: user.email ?? "",
          phone: user.phoneNumber ?? "",
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    } catch (error) {
      console.error("Google sign-in failed:", error);
      const message = describeAuthError(error);
      if (message) setAuthError(message);
    }
  }

  async function signInWithCredentials(username: string, password: string) {
    if (!firebaseAuthEnabled || !auth) {
      setAuthError("Firebase Auth is not configured in this environment.");
      return;
    }
    setAuthError(null);

    const trimmedUsername = username.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!trimmedUsername || !trimmedPassword) {
      setAuthError("Enter both username and password.");
      return;
    }

    // Firebase requires an email, so we append a hidden domain to the username
    const formattedEmail = `${trimmedUsername}@canteen.internal`;

    try {
      await signInWithEmailAndPassword(auth, formattedEmail, trimmedPassword);
    } catch (error) {
      console.error("Email sign-in failed:", error);
      setAuthError(describeAuthError(error) ?? "Sign-in failed.");
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      userProfile,
      authReady,
      authError,
      signInWithGoogle,
      signInWithCredentials,
      signOut: async () => {
        setAuthError(null);
        if (firebaseAuthEnabled && auth) {
          await firebaseSignOut(auth);
          return;
        }
        window.localStorage.removeItem(AUTH_STORAGE_KEY);
        setUserProfile(null);
      }
    }),
    [authError, authReady, userProfile]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
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
