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
  const hasAlmostReadyOrder = visibleOrders.some((order) => order.status === "almost_ready");

  let screenClass = "token-screen";
  if (hasReadyOrder) screenClass += " ready";
  else if (hasAlmostReadyOrder) screenClass += " almost_ready";

  return (
    <main className={screenClass}>
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
            const isAlmostReady = order.status === "almost_ready";
            
            let cardClass = "token-status-card";
            if (isReady) cardClass += " ready";
            else if (isAlmostReady) cardClass += " almost_ready";

            return (
              <article className={cardClass} key={order.id}>
                <div className="token-number-ring">
                  <strong>{order.token}</strong>
                </div>
                <span>{isReady ? "Cooked" : isAlmostReady ? "Almost Ready" : "Cooking"}</span>
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
