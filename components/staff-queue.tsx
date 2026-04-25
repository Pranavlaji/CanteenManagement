"use client";

import { timeAgo } from "@/lib/format";
import { MenuItem, Order, OrderStatus } from "@/lib/types";
import { Wifi, WifiOff } from "lucide-react";
import { useState } from "react";

const nextStatus: Partial<Record<OrderStatus, OrderStatus>> = {
  placed: "preparing",
  preparing: "ready",
  ready: "completed"
};

export function StaffQueue({
  orders,
  menu,
  onTransition,
  onToggleAvailability
}: {
  orders: Order[];
  menu: MenuItem[];
  onTransition: (orderId: string, status: OrderStatus) => void;
  onToggleAvailability: (itemId: string) => void;
}) {
  const [online, setOnline] = useState(true);
  const active = orders.filter((order) => ["placed", "preparing", "ready"].includes(order.status));

  return (
    <main className="screen-grid staff-layout">
      <section className="workspace">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Kitchen queue</p>
            <h1>Live orders for preparation.</h1>
          </div>
          <button className="ghost-button" onClick={() => setOnline((value) => !value)} type="button">
            {online ? <Wifi size={17} /> : <WifiOff size={17} />}
            {online ? "Online" : "Offline"}
          </button>
        </div>
        {!online && (
          <div className="danger-box">
            Connection lost. Orders may not be current. Last known queue is still visible.
          </div>
        )}
        {active.length === 0 ? (
          <div className="empty-state">No active orders.</div>
        ) : (
          <div className="queue-list">
            {active.map((order) => {
              const next = nextStatus[order.status];
              return (
                <article className="queue-card" key={order.id}>
                  <div className="token-block">
                    <span>TOKEN</span>
                    <strong>T-{order.token}</strong>
                  </div>
                  <div>
                    <div className="order-title-row">
                      <h3>{order.customerName}</h3>
                      <span>{timeAgo(order.createdAt)}</span>
                    </div>
                    <p>{order.items.map((item) => `${item.quantity}x ${item.name}`).join(", ")}</p>
                    <div className={`status-badge ${order.status}`}>{order.status}</div>
                  </div>
                  {next && (
                    <button
                      className="primary-button compact"
                      onClick={() => onTransition(order.id, next)}
                      type="button"
                    >
                      Mark {next}
                    </button>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
      <aside className="sidebar">
        <div className="panel">
          <h3>Availability</h3>
          <div className="availability-list">
            {menu.map((item) => (
              <label className="toggle-row" key={item.id}>
                <span>{item.name}</span>
                <input
                  checked={item.available}
                  onChange={() => onToggleAvailability(item.id)}
                  type="checkbox"
                />
              </label>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
