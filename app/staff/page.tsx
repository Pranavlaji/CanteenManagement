"use client";

import { RoleGate } from "@/components/role-gate";
import { StaffQueue } from "@/components/staff-queue";
import { seedMenu, seedOrders } from "@/lib/mock-data";
import { subscribeToStaffOrders, updateOrderStatusInStore } from "@/lib/order-store";
import { OrderStatus } from "@/lib/types";
import { useEffect, useState } from "react";

const VIEWED_ORDERS_KEY = "canteen.demo.viewedKitchenOrders";

export default function StaffPage() {
  const [orders, setOrders] = useState(seedOrders);
  const [menu, setMenu] = useState(seedMenu);
  const [viewedOrderIds, setViewedOrderIds] = useState<string[]>([]);

  useEffect(() => {
    setViewedOrderIds(readViewedOrders());
    const unsubscribe = subscribeToStaffOrders((fetchedOrders) => {
      // In demo mode with empty local storage, we might still want to show seedOrders
      // if it's completely empty, but let's just use what's returned.
      setOrders(fetchedOrders);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  function transitionOrder(orderId: string, status: OrderStatus) {
    // Optimistic update
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
      )
    );
    // Real update
    updateOrderStatusInStore(orderId, status).catch(console.error);
  }

  function toggleAvailability(itemId: string) {
    setMenu((current) =>
      current.map((item) =>
        item.id === itemId ? { ...item, available: !item.available } : item
      )
    );
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
