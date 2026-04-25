"use client";

import { money } from "@/lib/format";
import { CartItem, Order } from "@/lib/types";
import { Home, Minus, Plus, ReceiptIndianRupee, ShoppingBag, UserRound } from "lucide-react";

export function CartPanel({
  cart,
  activeOrder,
  onQuantityChange,
  onCheckout
}: {
  cart: CartItem[];
  activeOrder?: Order;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onCheckout: () => void;
}) {
  const total = cart.reduce((sum, item) => sum + item.item.pricePaisa * item.quantity, 0);
  const disabled = cart.length === 0 || Boolean(activeOrder);
  const itemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="order-dock">
      <div className="order-dock-summary">
        <div>
          <p className="eyebrow">My order</p>
          <h3>{itemCount > 0 ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : "Take out"}</h3>
        </div>
        <div className="dock-total">
          <span>Total</span>
          <strong>{money(total)}</strong>
        </div>
      </div>
      {activeOrder && (
        <div className="warning-box">
          You already have order T-{activeOrder.token}. Complete it before placing another.
        </div>
      )}
      {cart.length === 0 ? (
        <p className="muted">Add food from the menu to start an order.</p>
      ) : (
        <div className="cart-lines compact">
          {cart.map((line) => (
            <div className="cart-line" key={line.item.id}>
              <div>
                <strong>{line.item.name}</strong>
                <span>{money(line.item.pricePaisa * line.quantity)}</span>
              </div>
              <div className="stepper">
                <button
                  onClick={() => onQuantityChange(line.item.id, line.quantity - 1)}
                  type="button"
                >
                  <Minus size={15} />
                </button>
                <span>{line.quantity}</span>
                <button
                  onClick={() => onQuantityChange(line.item.id, line.quantity + 1)}
                  type="button"
                >
                  <Plus size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="dock-actions">
        <div className="dock-nav" aria-label="Student shortcuts">
          <button aria-label="Menu" type="button">
            <Home size={18} />
          </button>
          <button aria-label="Cart" className="active" type="button">
            <ShoppingBag size={18} />
          </button>
          <button aria-label="Account" type="button">
            <UserRound size={18} />
          </button>
        </div>
        <button className="primary-button dock-pay" disabled={disabled} onClick={onCheckout} type="button">
          <ReceiptIndianRupee size={18} />
          Pay and place order
        </button>
      </div>
    </div>
  );
}
