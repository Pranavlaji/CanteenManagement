"use client";

import { useAuth } from "@/components/auth-provider";
import { ShieldCheck, Smartphone } from "lucide-react";
import { useState } from "react";

export function AuthPanel() {
  const { signInDemo } = useAuth();
  const [name, setName] = useState("Pranav");
  const [phone, setPhone] = useState("+91 90000 00000");

  return (
    <div className="panel">
      <div className="panel-title">
        <Smartphone size={20} />
        <h3>Create your student account</h3>
      </div>
      <p className="muted">
        Browse freely. Checkout requires a one-time phone account so orders,
        refunds, and support stay tied to the right student.
      </p>
      <label>
        Name
        <input value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label>
        Phone
        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <button
        className="primary-button"
        onClick={() => signInDemo({ name, phone, role: "student" })}
        type="button"
      >
        <ShieldCheck size={18} />
        Continue with phone
      </button>
      <p className="fine-print">
        Demo mode signs in locally. Production uses Firebase Phone Auth OTP.
      </p>
    </div>
  );
}
