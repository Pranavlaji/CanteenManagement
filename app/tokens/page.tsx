"use client";

import { AuthPanel } from "@/components/auth-panel";
import { OrderTracker } from "@/components/order-tracker";
import { useAuth } from "@/components/auth-provider";
import { subscribeToStudentOrders } from "@/lib/order-store";
import { Order } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function TokensPage() {
  const { authReady, userProfile } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (!userProfile) {
      setOrders([]);
      return;
    }

    const unsubscribe = subscribeToStudentOrders(userProfile.uid, (fetchedOrders) => {
      setOrders(fetchedOrders);
    });

    return () => {
      unsubscribe();
    };
  }, [userProfile]);

  const studentOrders = orders;

  if (!authReady) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
      </div>
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
