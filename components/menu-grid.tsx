"use client";

import { money } from "@/lib/format";
import { MenuItem } from "@/lib/types";
import { Coffee, Cookie, Search, Soup, Utensils } from "lucide-react";
import { useState } from "react";

const categories = ["all", "meal", "snack", "drink"] as const;
const categoryCopy = {
  all: { label: "All", Icon: Utensils },
  meal: { label: "Meals", Icon: Soup },
  snack: { label: "Snacks", Icon: Cookie },
  drink: { label: "Drinks", Icon: Coffee }
};

export function MenuGrid({
  items,
  onAdd
}: {
  items: MenuItem[];
  onAdd: (item: MenuItem) => void;
}) {
  const [category, setCategory] = useState<(typeof categories)[number]>("all");
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visible = items.filter((item) => {
    if (!item.available) return false;
    const categoryMatch = category === "all" || item.category === category;
    const searchMatch =
      normalizedQuery.length === 0 ||
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery);

    return categoryMatch && searchMatch;
  });

  return (
    <>
      <label className="menu-search" aria-label="Search menu">
        <Search size={24} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search"
          type="search"
        />
      </label>
      <div className="category-strip" aria-label="Menu categories">
        {categories.map((item) => (
          <button
            key={item}
            aria-label={categoryCopy[item].label}
            className={category === item ? "category-bubble active" : "category-bubble"}
            onClick={() => setCategory(item)}
            type="button"
          >
            {(() => {
              const Icon = categoryCopy[item].Icon;
              return <Icon size={24} />;
            })()}
          </button>
        ))}
      </div>
      <div className="menu-grid">
        {visible.length === 0 ? (
          <div className="empty-state menu-empty">No items match your search.</div>
        ) : null}
        {visible.map((item) => (
          <button
            className={item.available ? "menu-card" : "menu-card unavailable"}
            disabled={!item.available}
            key={item.id}
            onClick={() => onAdd(item)}
            type="button"
          >
            <div className={`food-visual ${item.category}`}>
              <span aria-hidden="true" />
            </div>
            <div className="menu-card-body">
              <div>
                <div className="menu-card-title">
                  <h3>{item.name}</h3>
                </div>
                <p>{money(item.pricePaisa)}</p>
              </div>
              <span className="sr-only">{item.available ? "Add to cart" : "Sold out"}</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
