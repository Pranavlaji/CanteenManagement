"use client";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { addMenuItem, removeMenuItem, subscribeToMenu, updateMenuItemPrice } from "@/lib/menu-store";
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

  async function updatePrice(itemId: string, pricePaisa: number) {
    const previousMenu = menu;
    setMenu((current) => current.map((item) => item.id === itemId ? { ...item, pricePaisa } : item));
    await updateMenuItemPrice(itemId, pricePaisa).catch((error) => {
      console.error("Failed to update item price:", error);
      setMenu(previousMenu);
      window.alert("Could not update the price. Check Firestore rules and your admin role.");
    });
  }

  async function addDish(item: Omit<MenuItem, "id">) {
    await addMenuItem(item).catch((error) => {
      console.error("Failed to add menu item:", error);
      window.alert("Could not add the item. Check Firestore rules and your admin role.");
    });
  }

  async function removeDish(itemId: string) {
    const previousMenu = menu;
    setMenu((current) => current.filter((item) => item.id !== itemId));
    await removeMenuItem(itemId).catch((error) => {
      console.error("Failed to remove menu item:", error);
      setMenu(previousMenu);
      window.alert("Could not remove the item. Check Firestore rules and your admin role.");
    });
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
          onUpdatePrice={updatePrice}
          onAddDish={addDish}
          onRemoveDish={removeDish}
        />
      </AppShell>
    </RoleGate>
  );
}
