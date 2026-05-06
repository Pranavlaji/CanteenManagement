"use client";

import { AdminDashboard } from "@/components/admin-dashboard";
import { AppShell } from "@/components/app-shell";
import { RoleGate } from "@/components/role-gate";
import { useAuth } from "@/components/auth-provider";
import { subscribeToMenu } from "@/lib/menu-store";
import { subscribeToStaffOrders } from "@/lib/order-store";
import { MenuItem } from "@/lib/types";
import { LayoutDashboard } from "lucide-react";
import { useEffect, useState } from "react";

export default function AdminPage() {
  const { getIdToken } = useAuth();
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

  async function authHeaders() {
    const idToken = await getIdToken();
    if (!idToken) throw new Error("Please sign in again.");
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
    };
  }

  async function updatePrice(itemId: string, pricePaisa: number) {
    const previousMenu = menu;
    setMenu((current) => current.map((item) => item.id === itemId ? { ...item, pricePaisa } : item));
    try {
      const res = await fetch("/api/menu", {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({ itemId, action: "price", pricePaisa }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update item price.");
      }
    } catch (error) {
      console.error("Failed to update item price:", error);
      setMenu(previousMenu);
      window.alert("Could not update the price. Check Firestore rules and your admin role.");
    }
  }

  async function addDish(item: Omit<MenuItem, "id">) {
    try {
      const res = await fetch("/api/menu", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify(item),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to add menu item.");
      }
    } catch (error) {
      console.error("Failed to add menu item:", error);
      window.alert("Could not add the item. Check Firestore rules and your admin role.");
    }
  }

  async function removeDish(itemId: string) {
    const previousMenu = menu;
    setMenu((current) => current.filter((item) => item.id !== itemId));
    try {
      const res = await fetch(`/api/menu?itemId=${encodeURIComponent(itemId)}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to remove menu item.");
      }
    } catch (error) {
      console.error("Failed to remove menu item:", error);
      setMenu(previousMenu);
      window.alert("Could not remove the item. Check Firestore rules and your admin role.");
    }
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
