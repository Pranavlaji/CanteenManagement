"use client";

import { money } from "@/lib/format";
import { CartItem } from "@/lib/types";
import { ChevronRight, Minus, Mail, Plus, ReceiptText, X } from "lucide-react";

export function CartReview({
  cart,
  signedIn,
  phone,
  paying,
  onClose,
  onQuantityChange,
  onOrderNow,
  onSignIn,
  onAddMore
}: {
  cart: CartItem[];
  signedIn: boolean;
  phone: string;
  paying: boolean;
  onClose: () => void;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onOrderNow: () => void;
  onSignIn: () => void;
  onAddMore: () => void;
}) {
  const total = cart.reduce((sum, item) => sum + item.item.pricePaisa * item.quantity, 0);
  const disabled = cart.length === 0 || paying;
  const actionLabel = signedIn ? (paying ? "Opening payment..." : "Checkout") : "Sign in";

  return (
    <div className="cart-review-backdrop">
      <section className="cart-review" aria-label="Cart details">
        <header className="cart-review-hero">
          <button className="cart-review-close" onClick={onClose} type="button" aria-label="Close cart">
            <X size={30} />
          </button>
          <h2>Lets review your order!</h2>
        </header>
        <section className="cart-items-panel">
          {cart.length === 0 ? (
            <div className="empty-state">Your cart is empty.</div>
          ) : (
            <div className="review-lines">
              {cart.map((line) => (
                <div className="review-line" key={line.item.id}>
                  <strong>{line.item.name}</strong>
                  <div className="review-item-controls">
                    <div className="review-stepper">
                      <button onClick={() => onQuantityChange(line.item.id, line.quantity - 1)} type="button">
                        <Minus size={18} />
                      </button>
                      <span>{line.quantity}</span>
                      <button onClick={() => onQuantityChange(line.item.id, line.quantity + 1)} type="button">
                        <Plus size={18} />
                      </button>
                    </div>
                    <span className="review-line-price">{money(line.item.pricePaisa * line.quantity)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <button className="add-more-row" onClick={onAddMore} type="button">
            <Plus size={22} />
            Add more items!
          </button>
        </section>
        <section className="cart-summary-panel">
          <button className="summary-row" type="button">
            <span>
              <Mail size={22} />
              <strong>{phone}</strong>
            </span>
            <ChevronRight size={28} />
          </button>
          <button className="summary-row" type="button">
            <span>
              <ReceiptText size={24} />
              <span>Total Bill:</span>
              <strong>{money(total)}</strong>
            </span>
            <ChevronRight size={28} />
          </button>
        </section>
        <button
          className="cart-primary-action"
          disabled={disabled}
          onClick={signedIn ? onOrderNow : onSignIn}
          type="button"
        >
          {actionLabel}
        </button>
      </section>
    </div>
  );
}
