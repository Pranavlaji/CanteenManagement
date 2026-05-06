"use client";

import { RoleGate } from "@/components/role-gate";
import { StaffQueue } from "@/components/staff-queue";
import { useAuth } from "@/components/auth-provider";
import { subscribeToMenu } from "@/lib/menu-store";
import { subscribeToStaffOrders } from "@/lib/order-store";
import { MenuItem, Order, OrderStatus } from "@/lib/types";
import { useEffect, useState } from "react";

const VIEWED_ORDERS_KEY = "canteen.demo.viewedKitchenOrders";

export default function StaffPage() {
  const { getIdToken } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [viewedOrderIds, setViewedOrderIds] = useState<string[]>([]);

  // Subscribe to real-time menu from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToMenu((items) => {
      setMenu(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    setViewedOrderIds(readViewedOrders());
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

  async function transitionOrder(orderId: string, status: OrderStatus) {
    const previousOrders = orders;
    // Optimistic update
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
      )
    );
    try {
      const res = await fetch("/api/orders/status", {
        method: "POST",
        headers: await authHeaders(),
        body: JSON.stringify({ orderId, status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update order status.");
      }
      const data = await res.json();
      if (data.order) {
        setOrders((current) =>
          current.map((order) => order.id === orderId ? { ...order, ...data.order } : order)
        );
      }
    } catch (error) {
      console.error("Failed to update order status:", error);
      setOrders(previousOrders);
      window.alert("Could not update the order status. Check your staff role.");
    }
  }

  async function toggleAvailability(itemId: string) {
    const item = menu.find((m) => m.id === itemId);
    if (!item) return;

    const previousMenu = menu;
    const nextAvailable = !item.available;
    // Optimistic update
    setMenu((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, available: nextAvailable } : item
      )
    );
    try {
      const res = await fetch("/api/menu", {
        method: "PATCH",
        headers: await authHeaders(),
        body: JSON.stringify({
          itemId,
          action: "availability",
          available: nextAvailable,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update item availability.");
      }
    } catch (error) {
      console.error("Failed to update item availability:", error);
      setMenu(previousMenu);
      window.alert("Could not update item availability. Check Firestore rules and your staff role.");
    }
  }

  function markOrderViewed(orderId: string) {
    setViewedOrderIds((current) => {
      if (current.includes(orderId)) return current;
      const next = [...current, orderId];
      window.localStorage.setItem(VIEWED_ORDERS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return (
    <RoleGate
      role="staff"
      title="Kitchen queue is a separate workspace."
      description="Staff can open live orders and availability controls here without entering the student ordering flow."
    >
      <StaffQueue
        orders={orders}
        menu={menu}
        onTransition={transitionOrder}
        onToggleAvailability={toggleAvailability}
        viewedOrderIds={viewedOrderIds}
        onViewOrder={markOrderViewed}
      />
    </RoleGate>
  );
}

function readViewedOrders() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(VIEWED_ORDERS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
