"use client";

import { MenuItem, Order, OrderStatus } from "@/lib/types";
import { CheckCheck } from "lucide-react";

const actionCopy: Partial<Record<OrderStatus, { label: string; next: OrderStatus }>> = {
  placed: { label: "Verify order", next: "preparing" },
  preparing: { label: "Almost Ready", next: "almost_ready" },
  almost_ready: { label: "Mark As done", next: "ready" },
  ready: { label: "Complete pickup", next: "completed" }
};

export function StaffQueue({
  orders,
  menu,
  onTransition,
  onToggleAvailability,
  viewedOrderIds,
  onViewOrder
}: {
  orders: Order[];
  menu: MenuItem[];
  onTransition: (orderId: string, status: OrderStatus) => void | Promise<void>;
  onToggleAvailability: (itemId: string) => void;
  viewedOrderIds: string[];
  onViewOrder: (orderId: string) => void;
}) {
  const active = orders.filter((order) => ["placed", "preparing", "almost_ready", "ready"].includes(order.status));
  const viewed = new Set(viewedOrderIds);

  return (
    <main className="kitchen-screen">
      <header className="kitchen-topbar">
        <h1>{active.length} Order{active.length === 1 ? "" : "s"}</h1>
        <div className="kitchen-avatar" aria-hidden="true" />
      </header>
      <section className="kitchen-board">
        {active.length === 0 ? (
          <div className="empty-state kitchen-empty">No active orders.</div>
        ) : (
          active.map((order) => {
            const isUnviewed = !viewed.has(order.id);
            const action = actionCopy[order.status];

            return (
              <article
                className={[
                  "kitchen-card",
                  isUnviewed ? "new" : "",
                  `status-${order.status}`
                ].filter(Boolean).join(" ")}
                key={order.id}
                onClick={() => onViewOrder(order.id)}
              >
                <div className="kitchen-token">Token {order.token}</div>
                <div className="kitchen-items">
                  {order.items.map((item) => (
                    <div className="kitchen-item" key={`${order.id}-${item.itemId}`}>
                      <strong>{item.quantity}x</strong>
                      <span>{item.name}</span>
                    </div>
                  ))}
                </div>
                {action && (
                  <button
                    className="kitchen-done-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onViewOrder(order.id);
                      onTransition(order.id, action.next);
                    }}
                    type="button"
                  >
                    <CheckCheck size={16} />
                    {action.label}
                  </button>
                )}
              </article>
            );
          })
        )}
      </section>
      <aside className="kitchen-availability">
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
