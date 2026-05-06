"use client";

import { AuthPanel } from "@/components/auth-panel";
import { useAuth } from "@/components/auth-provider";
import { Role } from "@/lib/types";
import { LogOut } from "lucide-react";

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
  const allowedRoles = role === "staff" ? ["staff", "admin"] : [role];
  const isAllowed = userProfile ? allowedRoles.includes(userProfile.role) : false;
  const isBlockedByOtherRole = Boolean(userProfile && !isAllowed);

  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (isBlockedByOtherRole) {
    return (
      <main className="access-screen">
        <div className="access-denied-card">
          <h1>
            Access Denied
          </h1>
          <p>
            This page requires <strong>{role}</strong> access. You are signed in
            as <strong>{userProfile?.role || "student"}</strong>.
          </p>
          <button className="primary-button" onClick={signOut} type="button">
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </main>
    );
  }

  if (isAllowed) {
    return <>{children}</>;
  }

  return (
    <main className="access-screen">
      <AuthPanel
        mode="credentials"
        demoRole={role}
        title={`Sign in for ${role} access`}
        description={`Use your ${role} email and password to continue.`}
      />
    </main>
  );
}
