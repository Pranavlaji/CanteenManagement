"use client";

import { money } from "@/lib/format";
import { CartItem } from "@/lib/types";
import { ChevronRight } from "lucide-react";

export function CartPanel({
  cart,
  onViewCart
}: {
  cart: CartItem[];
  onViewCart: () => void;
}) {
  const total = cart.reduce((sum, item) => sum + item.item.pricePaisa * item.quantity, 0);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  if (cart.length === 0) return null;

  return (
    <button className="order-dock" onClick={onViewCart} type="button">
      <span>{itemCount} Item{itemCount === 1 ? "" : "s"} Added to Cart</span>
      <span className="order-dock-action">
        View Cart
        <ChevronRight size={22} />
      </span>
      <span className="sr-only">Cart total {money(total)}</span>
    </button>
  );
}
