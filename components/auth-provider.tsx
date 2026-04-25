"use client";

import { UserProfile } from "@/lib/types";
import { createContext, useContext, useMemo, useState } from "react";

type AuthContextValue = {
  userProfile: UserProfile | null;
  signInDemo: (profile: Omit<UserProfile, "uid" | "role"> & { role?: UserProfile["role"] }) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      userProfile,
      signInDemo: ({ name, phone, role = "student" }) => {
        setUserProfile({
          uid: `demo_${phone.replace(/\D/g, "") || "student"}`,
          name,
          phone,
          role
        });
      },
      signOut: () => setUserProfile(null)
    }),
    [userProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return value;
}
