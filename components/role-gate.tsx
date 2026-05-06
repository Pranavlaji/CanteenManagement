"use client";

import { AuthPanel } from "@/components/auth-panel";
import { useAuth } from "@/components/auth-provider";
import { Role } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

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
  const { authReady, userProfile } = useAuth();
  const router = useRouter();
  const isAllowed = userProfile?.role === role;
  const isBlockedByOtherRole = Boolean(userProfile && userProfile.role !== role);
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  // Show access denied message and redirect — don't sign out the user
  useEffect(() => {
    if (isBlockedByOtherRole) {
      setShowAccessDenied(true);
      const timer = setTimeout(() => {
        router.push("/");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isBlockedByOtherRole, router]);

  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
    );
  }

  if (showAccessDenied) {
    return (
      <main className="access-screen">
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            textAlign: "center",
            fontFamily: "system-ui, -apple-system, sans-serif",
            color: "#e2e8f0",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🚫</div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              marginBottom: "0.5rem",
              color: "#f8fafc",
            }}
          >
            Access Denied
          </h1>
          <p
            style={{
              fontSize: "0.95rem",
              color: "#94a3b8",
              marginBottom: "0.5rem",
              maxWidth: "400px",
            }}
          >
            This page requires <strong>{role}</strong> access. You are signed in
            as <strong>{userProfile?.role || "student"}</strong>.
          </p>
          <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
            Redirecting to home page…
          </p>
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
        mode="google"
        demoRole={role}
        title={`Sign in for ${role} access`}
        description={`Use your Google account to sign in for ${role} access.`}
      />
    </main>
  );
}
