"use client";

import { money, timeAgo } from "@/lib/format";
import { Order } from "@/lib/types";
import { CircleCheck, TimerReset } from "lucide-react";

export function OrderTracker({
  orders,
  onCancel
}: {
  orders: Order[];
  onCancel: (orderId: string) => void;
}) {
  return (
    <main className="workspace solo">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Student orders</p>
          <h1>Track tokens and refunds.</h1>
        </div>
      </div>
      {orders.length === 0 ? (
        <div className="empty-state">No orders yet. Place one from the menu.</div>
      ) : (
        <div className="order-list">
          {orders.map((order) => {
            const cancellable =
              order.status === "placed" &&
              Date.now() - new Date(order.createdAt).getTime() < 90_000;
            return (
              <article className="order-card" key={order.id}>
                <div className="token-block">
                  <span>Token</span>
                  <strong>T-{order.token}</strong>
                </div>
                <div className="order-main">
                  <div className="order-title-row">
                    <h3>{order.status}</h3>
                    <span>{money(order.totalPaisa)}</span>
                  </div>
                  <p>{order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}</p>
                  <div className="meta-row">
                    <span><TimerReset size={15} /> {timeAgo(order.createdAt)} ago</span>
                    <span><CircleCheck size={15} /> {order.paymentStatus}</span>
                  </div>
                </div>
                <button disabled={!cancellable} onClick={() => onCancel(order.id)} type="button">
                  Cancel
                </button>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
