"use client";

import { useAuth } from "@/components/auth-provider";
import { LogOut, ShoppingBag, type LucideIcon } from "lucide-react";

type Tab<T extends string> = {
  id: T;
  label: string;
  icon: LucideIcon;
};

type AppShellProps<T extends string> = {
  tabs: Array<Tab<T>>;
  currentView: T;
  onViewChange: (view: T) => void;
  cartCount: number;
  children: React.ReactNode;
};

export function AppShell<T extends string>({
  tabs,
  currentView,
  onViewChange,
  cartCount,
  children
}: AppShellProps<T>) {
  const { userProfile, signOut } = useAuth();

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="brand-mark">
          <span>C</span>
        </div>
        <div className="brand-copy">
          <p className="eyebrow">College canteen</p>
          <h2>CanteenOS</h2>
        </div>
        <nav className="tabs" aria-label="Main navigation">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                className={currentView === tab.id ? "tab active" : "tab"}
                key={tab.id}
                onClick={() => onViewChange(tab.id)}
                type="button"
              >
                <Icon size={17} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
        <div className="account-strip">
          {cartCount > 0 && (
            <div className="cart-chip" title="Cart items">
              <ShoppingBag size={17} />
              {cartCount}
            </div>
          )}
          {userProfile ? (
            <>
              <div className="identity">
                <strong>{userProfile.name}</strong>
                <span>{userProfile.role}</span>
              </div>
              <button className="icon-button" onClick={signOut} type="button" title="Sign out">
                <LogOut size={18} />
              </button>
            </>
          ) : (
            <span className="guest-chip">Guest browsing</span>
          )}
        </div>
      </header>
      {children}
    </div>
  );
}
