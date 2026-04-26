"use client";

import { AuthPanel } from "@/components/auth-panel";
import { useAuth } from "@/components/auth-provider";
import { Role } from "@/lib/types";
import { useEffect } from "react";

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

  useEffect(() => {
    if (isBlockedByOtherRole) {
      signOut();
    }
  }, [isBlockedByOtherRole, signOut]);

  if (!authReady || isBlockedByOtherRole) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
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
        description={`Enter the username and password for your ${role} account.`}
      />
    </main>
  );
}
