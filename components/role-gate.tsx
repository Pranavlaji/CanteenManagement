"use client";

import { AuthPanel } from "@/components/auth-panel";
import { useAuth } from "@/components/auth-provider";
import { Role } from "@/lib/types";
import { LockKeyhole, LogOut } from "lucide-react";

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
  const { authReady, userProfile, signOut } = useAuth();
  const isAllowed = userProfile?.role === role;
  const isBlockedByOtherRole = Boolean(userProfile && userProfile.role !== role);

  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (isAllowed) {
    return <>{children}</>;
  }

  if (!isBlockedByOtherRole) {
    return (
      <main className="access-screen">
        <AuthPanel
          mode="credentials"
          demoRole={role}
          title={`Sign in for ${role} access`}
          description={`Enter the email and password for your ${role} account.`}
        />
      </main>
    );
  }

  return (
    <main className="access-screen">
      <section className="access-panel">
        <div className="access-icon">
          <LockKeyhole size={24} />
        </div>
        <p className="eyebrow">{role} access</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
        <div className="danger-box">
          Signed in as {userProfile?.role}. Sign out before opening this {role} workspace.
        </div>
        <div className="access-actions">
          {userProfile ? (
            <button className="ghost-button" onClick={signOut} type="button">
              <LogOut size={17} />
              Sign out
            </button>
          ) : null}
        </div>
        <p className="fine-print">
          Staff and admin access are controlled by Firebase Auth custom claims.
        </p>
      </section>
    </main>
  );
}
