"use client";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { seedMenu, seedOrders } from "@/lib/mock-data";
import { LayoutDashboard } from "lucide-react";
import { useState } from "react";

export default function AdminPage() {
  const [orders] = useState(seedOrders);
  const [menu, setMenu] = useState(seedMenu);

  function toggleAvailability(itemId: string) {
    setMenu((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, available: !item.available } : item
      )
    );
  }

  return (
    <RoleGate
      role="admin"
      title="Admin dashboard is isolated from ordering."
      description="Admins manage metrics and menu controls from this screen only. Student users cannot switch into it from the menu."
    >
      <AppShell
        tabs={[{ id: "admin" as const, label: "Admin", icon: LayoutDashboard }]}
        currentView="admin"
        onViewChange={() => undefined}
        cartCount={0}
      >
        <AdminDashboard orders={orders} menu={menu} onToggleAvailability={toggleAvailability} />
      </AppShell>
    </RoleGate>
  );
}
