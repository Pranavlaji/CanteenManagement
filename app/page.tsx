"use client";

import { AppShell } from "@/components/app-shell";
import { AuthPanel } from "@/components/auth-panel";
import { CartPanel } from "@/components/cart-panel";
import { MenuGrid } from "@/components/menu-grid";
import { OrderTracker } from "@/components/order-tracker";
import { useAuth } from "@/components/auth-provider";
import { seedMenu } from "@/lib/mock-data";
import { CartItem, MenuItem, Order } from "@/lib/types";
import { ReceiptText, Utensils } from "lucide-react";
import { useMemo, useState } from "react";

type View = "menu" | "orders";

export default function Home() {
  const { userProfile } = useAuth();
  const [view, setView] = useState<View>("menu");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menu] = useState(seedMenu);

  const activeOrder = useMemo(
    () => orders.find((order) => !["completed", "cancelled"].includes(order.status)),
    [orders]
  );

  function addToCart(item: MenuItem) {
    if (!item.available) return;
    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.item.id === item.id);
      if (existing) {
        return current.map((cartItem) =>
          cartItem.item.id === item.id
            ? { ...cartItem, quantity: Math.min(5, cartItem.quantity + 1) }
            : cartItem
        );
      }
      if (current.length >= 10) return current;
      return [...current, { item, quantity: 1 }];
    });
  }

  function updateQuantity(itemId: string, quantity: number) {
    if (quantity <= 0) {
      setCart((current) => current.filter((item) => item.item.id !== itemId));
      return;
    }
    setCart((current) =>
      current.map((item) =>
        item.item.id === itemId ? { ...item, quantity: Math.min(5, quantity) } : item
      )
    );
  }

  function placeDemoOrder() {
    if (!userProfile || cart.length === 0) return;
    const totalPaisa = cart.reduce(
      (sum, item) => sum + item.item.pricePaisa * item.quantity,
      0
    );
    const now = new Date();
    const nextOrder: Order = {
      id: `order_${now.getTime()}`,
      token: orders.length + 47,
      userId: userProfile.uid,
      customerName: userProfile.name,
      items: cart.map((cartItem) => ({
        itemId: cartItem.item.id,
        name: cartItem.item.name,
        pricePaisa: cartItem.item.pricePaisa,
        quantity: cartItem.quantity
      })),
      totalPaisa,
      status: "placed",
      paymentStatus: "captured",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };
    setOrders((current) => [nextOrder, ...current]);
    setCart([]);
    setView("orders");
  }

  function transitionOrder(orderId: string, status: Order["status"]) {
    setOrders((current) =>
      current.map((order) =>
        order.id === orderId
          ? { ...order, status, updatedAt: new Date().toISOString() }
          : order
      )
    );
  }

  const tabs = [
    { id: "menu" as const, label: "Menu", icon: Utensils },
    { id: "orders" as const, label: "Orders", icon: ReceiptText }
  ];

  return (
    <AppShell
      tabs={tabs}
      currentView={view}
      onViewChange={setView}
      cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
    >
      {view === "menu" && (
        <main className="student-screen">
          <section className="student-hero">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Today&apos;s menu</p>
                <h1>
                  Hey,
                  <span>{userProfile ? userProfile.name.split(" ")[0] : "what's up"}?</span>
                </h1>
                <p className="hero-copy">
                  Pick your canteen favourites, pay from your phone, and collect with a token.
                </p>
              </div>
              <div className="status-pill">Open now</div>
            </div>
            {!userProfile && <AuthPanel />}
          </section>
          <section className="workspace">
            <MenuGrid items={menu} onAdd={addToCart} />
          </section>
          <CartPanel
            cart={cart}
            activeOrder={activeOrder}
            onQuantityChange={updateQuantity}
            onCheckout={placeDemoOrder}
          />
        </main>
      )}

      {view === "orders" && (
        userProfile ? (
          <OrderTracker orders={orders} onCancel={(id) => transitionOrder(id, "cancelled")} />
        ) : (
          <main className="workspace solo">
            <AuthPanel />
          </main>
        )
      )}

      {cart.length > 0 && view !== "menu" && (
        <button className="floating-cart" onClick={() => setView("menu")} type="button">
          Back to cart
          <span>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
        </button>
      )}
    </AppShell>
  );
}
