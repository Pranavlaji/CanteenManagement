"use client";

import { money } from "@/lib/format";
import { MenuItem, Order } from "@/lib/types";
import { BarChart3, IndianRupee, ReceiptText, Trash2, UsersRound, type LucideIcon } from "lucide-react";

import { useState } from "react";

export function AdminDashboard({
  orders,
  menu,
  onUpdatePrice,
  onAddDish,
  onRemoveDish
}: {
  orders: Order[];
  menu: MenuItem[];
  onUpdatePrice: (itemId: string, pricePaisa: number) => void;
  onAddDish: (item: Omit<MenuItem, "id">) => void;
  onRemoveDish: (itemId: string) => void;
}) {
  const completed = orders.filter((order) => order.status === "completed");
  const revenue = completed.reduce((sum, order) => sum + order.totalPaisa, 0);
  const active = orders.filter((order) => ["placed", "preparing", "almost_ready", "ready"].includes(order.status));

  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [newCategory, setNewCategory] = useState<"meal" | "snack" | "drink">("meal");

  return (
    <main className="workspace solo">
      <div className="section-heading" style={{ marginBottom: "3rem" }}>
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2>Menu controls</h2>
        </div>
        <div className="admin-list">
          {menu.map((item) => (
            <div className="admin-row" key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {money(item.pricePaisa)} · {item.category}
                </span>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                <button 
                  onClick={() => {
                    const input = window.prompt(`Enter new price for ${item.name} (in ₹):`, (item.pricePaisa / 100).toString());
                    if (input !== null && !isNaN(Number(input))) {
                      onUpdatePrice(item.id, Math.round(Number(input) * 100));
                    }
                  }} 
                  type="button" 
                  style={{ background: "#f1f5f9", color: "#475569" }}
                >
                  Edit Price
                </button>
                <button
                  onClick={() => {
                    if (window.confirm(`Remove ${item.name} from the menu?`)) {
                      onRemoveDish(item.id);
                    }
                  }}
                  type="button"
                  style={{ background: "#fff0ed", color: "#b42318" }}
                >
                  <Trash2 size={16} />
                  Remove
                </button>
              </div>
            </div>
          ))}

          <form 
            className="admin-row" 
            style={{ background: "#fafafa", borderTop: "2px dashed #e9e9e9" }}
            onSubmit={(e) => {
              e.preventDefault();
              if (!newName || !newPrice) return;
              onAddDish({
                name: newName,
                pricePaisa: Math.round(Number(newPrice) * 100),
                category: newCategory,
                available: true,
                description: "",
                imageUrl: newImageUrl.trim() || undefined
              });
              setNewName("");
              setNewPrice("");
              setNewImageUrl("");
            }}
          >
            <div style={{ display: "flex", gap: "10px", flex: 1 }}>
              <input 
                placeholder="New dish name" 
                value={newName} 
                onChange={(e) => setNewName(e.target.value)} 
                required 
                style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", width: "100%", maxWidth: "200px" }}
              />
              <input 
                type="number" 
                placeholder="Price (₹)" 
                value={newPrice} 
                onChange={(e) => setNewPrice(e.target.value)} 
                required 
                style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", width: "100px" }}
              />
              <input
                placeholder="/menu/dish.jpg"
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px", width: "100%", maxWidth: "180px" }}
              />
              <select 
                value={newCategory} 
                onChange={(e) => setNewCategory(e.target.value as any)}
                style={{ padding: "8px 12px", border: "1px solid #ddd", borderRadius: "6px" }}
              >
                <option value="meal">Meal</option>
                <option value="snack">Snack</option>
                <option value="drink">Drink</option>
              </select>
            </div>
            <button type="submit" style={{ background: "#017cf7", color: "white" }}>
              Add Dish
            </button>
          </form>
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
