"use client";

import { useAuth } from "@/components/auth-provider";
import { Role } from "@/lib/types";
import { LockKeyhole, LogOut, ShieldCheck } from "lucide-react";

const demoPeople: Record<Role, { name: string; phone: string }> = {
  student: { name: "Pranav", phone: "+91 90000 00000" },
  staff: { name: "Kitchen Staff", phone: "+91 91111 11111" },
  admin: { name: "Canteen Admin", phone: "+91 92222 22222" }
};

export function RoleGate({
  role,
  title,
  description,
  children
}: {
  role: Exclude<Role, "student">;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  const { userProfile, signInDemo, signOut } = useAuth();
  const isAllowed = userProfile?.role === role;
  const isBlockedByOtherRole = Boolean(userProfile && userProfile.role !== role);

  if (isAllowed) {
    return <>{children}</>;
  }

  const demoPerson = demoPeople[role];

  return (
    <main className="access-screen">
      <section className="access-panel">
        <div className="access-icon">
          <LockKeyhole size={24} />
        </div>
        <p className="eyebrow">{role} access</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        {isBlockedByOtherRole ? (
          <div className="danger-box">
            Signed in as {userProfile?.role}. Sign out before opening this {role} workspace.
          </div>
        ) : null}
        <div className="access-actions">
          {!isBlockedByOtherRole ? (
            <button
              className="primary-button"
              onClick={() => signInDemo({ ...demoPerson, role })}
              type="button"
            >
              <ShieldCheck size={18} />
              Continue to {role}
            </button>
          ) : null}
          {userProfile ? (
            <button className="ghost-button" onClick={signOut} type="button">
              <LogOut size={17} />
              Sign out
            </button>
          ) : null}
        </div>
        <p className="fine-print">
          Demo mode only. Production should use Firebase Auth custom claims and route guards.
        </p>
      </section>
    </main>
  );
}
