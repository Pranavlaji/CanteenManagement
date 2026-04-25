"use client";

import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { StaffQueue } from "@/components/staff-queue";
import { seedMenu, seedOrders } from "@/lib/mock-data";
import { OrderStatus } from "@/lib/types";
import { ClipboardList } from "lucide-react";
import { useState } from "react";

export default function StaffPage() {
  const [orders, setOrders] = useState(seedOrders);
  const [menu, setMenu] = useState(seedMenu);

  function transitionOrder(orderId: string, status: OrderStatus) {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
      )
    );
  }

  function toggleAvailability(itemId: string) {
    setMenu((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, available: !item.available } : item
      )
    );
  }

  return (
    <RoleGate
      role="staff"
      title="Kitchen queue is a separate workspace."
      description="Staff can open live orders and availability controls here without entering the student ordering flow."
    >
      <AppShell
        tabs={[{ id: "staff" as const, label: "Kitchen", icon: ClipboardList }]}
        currentView="staff"
        onViewChange={() => undefined}
        cartCount={0}
      >
        <StaffQueue
          orders={orders}
          menu={menu}
          onTransition={transitionOrder}
          onToggleAvailability={toggleAvailability}
        />
      </AppShell>
    </RoleGate>
  );
}
