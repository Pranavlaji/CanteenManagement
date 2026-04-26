"use client";

import { Order } from "@/lib/types";
import { X } from "lucide-react";

export function OrderTracker({
  orders,
  onClose
}: {
  orders: Order[];
  onClose: () => void;
}) {
  const visibleOrders = orders
    .filter((order) => !["cancelled", "completed"].includes(order.status))
    .sort((a, b) => {
      if (a.status === "ready" && b.status !== "ready") return -1;
      if (a.status !== "ready" && b.status === "ready") return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  const hasReadyOrder = visibleOrders.some((order) => order.status === "ready");

  return (
    <main className={`token-screen ${hasReadyOrder ? "ready" : ""}`}>
      <header className="token-screen-hero">
        <button className="token-screen-close" onClick={onClose} type="button" aria-label="Close token screen">
          <X size={30} />
        </button>
        <h1>Check on your orders!</h1>
      </header>

      {visibleOrders.length === 0 ? (
        <div className="token-empty-state">No active tokens yet.</div>
      ) : (
        <section className="token-card-list" aria-label="Active order tokens">
          {visibleOrders.map((order) => {
            const isReady = order.status === "ready";
            return (
              <article className={`token-status-card ${isReady ? "ready" : ""}`} key={order.id}>
                <div className="token-number-ring">
                  <strong>{order.token}</strong>
                </div>
                <span>{isReady ? "Cooked" : "Cooking"}</span>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
