"use client";

import { money } from "@/lib/format";
import { MenuItem } from "@/lib/types";
import { Coffee, Plus, Sandwich, Soup } from "lucide-react";
import { useState } from "react";

const categories = ["all", "meal", "snack", "drink"] as const;
const categoryCopy = {
  all: { title: "All", subtitle: "Full menu", Icon: Soup },
  meal: { title: "Meals", subtitle: "Lunch plates", Icon: Soup },
  snack: { title: "Snacks", subtitle: "Quick bites", Icon: Sandwich },
  drink: { title: "Drinks", subtitle: "Cold & hot", Icon: Coffee }
};

export function MenuGrid({
  items,
  onAdd
}: {
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
}) {
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const visible = category === "all" ? items : items.filter((item) => item.category === category);

  return (
    <>
      <div className="category-grid" aria-label="Menu categories">
        {categories.map((item) => (
          <button
            key={item}
            className={category === item ? `category-card ${item} active` : `category-card ${item}`}
            onClick={() => setCategory(item)}
            type="button"
          >
            {(() => {
              const Icon = categoryCopy[item].Icon;
              return <Icon size={24} />;
            })()}
            <span>
              <strong>{categoryCopy[item].title}</strong>
              <small>{categoryCopy[item].subtitle}</small>
            </span>
          </button>
        ))}
      </div>
      <div className="menu-grid">
        {visible.map((item) => (
          <article className={item.available ? "menu-card" : "menu-card unavailable"} key={item.id}>
            <div className={`food-visual ${item.category}`}>
              <span>{item.name.slice(0, 1)}</span>
            </div>
            <div className="menu-card-body">
              <div>
                <div className="menu-card-title">
                  <h3>{item.name}</h3>
                  <strong>{money(item.pricePaisa)}</strong>
                </div>
                <p>{item.description}</p>
              </div>
              <button
                className="add-button"
                disabled={!item.available}
                onClick={() => onAdd(item)}
                type="button"
              >
                <Plus size={18} />
                {item.available ? "Add" : "Sold out"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
