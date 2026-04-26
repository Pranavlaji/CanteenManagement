"use client";

import { useAuth } from "@/components/auth-provider";
import { firebaseAuthEnabled } from "@/lib/firebase";
import { ArrowLeft, ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";

export function AuthPanel({
  title = "Create your student account",
  description = "Browse freely. Checkout requires a one-time phone account so orders, refunds, and support stay tied to the right student.",
  demoRole = "student"
}: {
  title?: string;
  description?: string;
  demoRole?: "student" | "staff" | "admin";
}) {
  const {
    authError,
    confirmOtp,
    otpRequested,
    requestOtp,
    signInDemo,
    userProfile,
    cancelOtp
  } = useAuth();
  const [name, setName] = useState("Pranav");
  const [phone, setPhone] = useState("+919000000000");
  const [otpCode, setOtpCode] = useState("");

  return (
    <div className="panel">
      <div className="panel-title">
        <Smartphone size={20} />
        <h3>{title}</h3>
      </div>
      <p className="muted">{description}</p>
      {userProfile ? (
        <div className="notice-box">
          Signed in as {userProfile.name} ({userProfile.phone || userProfile.role}).
        </div>
      ) : null}
      {authError ? <div className="danger-box">{authError}</div> : null}
      {otpRequested ? (
        <>
          <label>
            OTP code
            <input
              inputMode="numeric"
              onChange={(event) => setOtpCode(event.target.value)}
              placeholder="Enter the 6-digit code"
              value={otpCode}
            />
          </label>
          <div className="access-actions">
            <button className="primary-button" onClick={() => confirmOtp(otpCode)} type="button">
              <ShieldCheck size={18} />
              Verify OTP
            </button>
            <button className="ghost-button" onClick={cancelOtp} type="button">
              <ArrowLeft size={17} />
              Edit phone number
            </button>
          </div>
        </>
      ) : (
        <>
          <label>
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            Phone
            <input
              inputMode="tel"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+919876543210"
              value={phone}
            />
          </label>
          <button
            className="primary-button"
            onClick={() => (
              firebaseAuthEnabled
                ? requestOtp({ name, phone })
                : signInDemo({ name, phone, role: demoRole })
            )}
            type="button"
          >
              <ShieldCheck size={18} />
            {firebaseAuthEnabled ? "Send OTP" : "Continue with phone"}
          </button>
        </>
      )}
      <p className="fine-print">
        {firebaseAuthEnabled
          ? "Firebase Phone Auth is enabled. We'll send an OTP to finish sign-in."
          : "Demo mode is active. Firebase Auth is wired but currently hidden."}
      </p>
    </div>
  );
}
