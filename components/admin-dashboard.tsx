"use client";

import { money } from "@/lib/format";
import { MenuItem, Order } from "@/lib/types";
import { BarChart3, IndianRupee, ReceiptText, UsersRound, type LucideIcon } from "lucide-react";

export function AdminDashboard({
  orders,
  menu,
  onToggleAvailability
}: {
  orders: Order[];
  menu: MenuItem[];
  onToggleAvailability: (itemId: string) => void;
}) {
  const completed = orders.filter((order) => order.status === "completed");
  const revenue = completed.reduce((sum, order) => sum + order.totalPaisa, 0);
  const active = orders.filter((order) => ["placed", "preparing", "ready"].includes(order.status));

  return (
    <main className="workspace solo">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Admin</p>
          <h1>Today&apos;s operations.</h1>
        </div>
      </div>
      <div className="metric-grid">
        <Metric icon={ReceiptText} label="Orders" value={orders.length.toString()} />
        <Metric icon={IndianRupee} label="Revenue" value={money(revenue)} />
        <Metric icon={UsersRound} label="Active queue" value={active.length.toString()} />
        <Metric icon={BarChart3} label="Items live" value={menu.filter((item) => item.available).length.toString()} />
      </div>
      <section className="admin-section">
        <h2>Menu controls</h2>
        <div className="admin-list">
          {menu.map((item) => (
            <div className="admin-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>{money(item.pricePaisa)} · {item.category}</span>
              </div>
              <button onClick={() => onToggleAvailability(item.id)} type="button">
                {item.available ? "Mark sold out" : "Make available"}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}

function Metric({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <article className="metric-card">
      <Icon size={22} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}
