"use client";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { addMenuItem, subscribeToMenu, toggleMenuItemAvailability, updateMenuItemPrice } from "@/lib/menu-store";
import { subscribeToStaffOrders } from "@/lib/order-store";
import { MenuItem } from "@/lib/types";
import { LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const [orders, setOrders] = useState<any[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);

  // Subscribe to real-time menu from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToMenu((items) => {
      setMenu(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToStaffOrders((fetchedOrders) => {
      setOrders(fetchedOrders);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  function toggleAvailability(itemId: string) {
    // Optimistic update
    setMenu((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, available: !item.available } : item
      )
    );
    // Persist to Firestore
    const item = menu.find((m) => m.id === itemId);
    if (item) {
      toggleMenuItemAvailability(itemId, !item.available).catch(console.error);
    }
  }

  async function updatePrice(itemId: string, pricePaisa: number) {
    setMenu((current) => current.map((item) => item.id === itemId ? { ...item, pricePaisa } : item));
    await updateMenuItemPrice(itemId, pricePaisa).catch(console.error);
  }

  async function addDish(item: Omit<MenuItem, "id">) {
    await addMenuItem(item).catch(console.error);
  }

  return (
    <RoleGate
      role="admin"
      title="Admin dashboard is isolated from ordering."
      description="Admins manage metrics and menu controls from this screen only. Student users cannot switch into it from the menu."
    >
      <AppShell
        tabs={[]}
        currentView="admin"
        onViewChange={() => undefined}
        cartCount={0}
      >
        <AdminDashboard 
          orders={orders} 
          menu={menu} 
          onToggleAvailability={toggleAvailability}
          onUpdatePrice={updatePrice}
          onAddDish={addDish}
        />
      </AppShell>
    </RoleGate>
  );
}
