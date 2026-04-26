"use client";

import { AuthPanel } from "@/components/auth-panel";
import { OrderTracker } from "@/components/order-tracker";
import { useAuth } from "@/components/auth-provider";
import { readOrders } from "@/lib/order-store";
import { Order } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TokensPage() {
  const { authReady, userProfile } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    setOrders(readOrders([]));

    function syncOrders() {
      setOrders(readOrders([]));
    }

    window.addEventListener("storage", syncOrders);
    window.addEventListener("canteen-orders-updated", syncOrders);
    window.addEventListener("focus", syncOrders);

    return () => {
      window.removeEventListener("storage", syncOrders);
      window.removeEventListener("canteen-orders-updated", syncOrders);
      window.removeEventListener("focus", syncOrders);
    };
  }, []);

  const studentOrders = userProfile
    ? orders.filter((order) => order.userId === userProfile.uid)
    : [];

  if (!authReady) {
    return (
      <main className="workspace solo">
        <div className="panel">
          <p className="muted">Loading your account...</p>
        </div>
      </main>
    );
  }

  if (!userProfile) {
    return (
      <main className="workspace solo">
        <AuthPanel title="Sign in to view your tokens" />
      </main>
    );
  }

  return <OrderTracker orders={studentOrders} onClose={() => router.push("/")} />;
}
