"use client";

import { AuthPanel } from "@/components/auth-panel";
import { CartPanel } from "@/components/cart-panel";
import { CartReview } from "@/components/cart-review";
import { MenuGrid } from "@/components/menu-grid";
import { useAuth } from "@/components/auth-provider";
import { seedMenu } from "@/lib/mock-data";
import { readOrders, writeOrders } from "@/lib/order-store";
import { CartItem, MenuItem, Order } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { authReady, userProfile } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [menu] = useState(seedMenu);

  useEffect(() => {
    setOrders(readOrders([]));

    function syncOrders() {
      setOrders(readOrders([]));
    }

    window.addEventListener("storage", syncOrders);
    window.addEventListener("canteen-orders-updated", syncOrders);
    window.addEventListener("focus", syncOrders);

    return () => {
      window.removeEventListener("storage", syncOrders);
      window.removeEventListener("canteen-orders-updated", syncOrders);
      window.removeEventListener("focus", syncOrders);
    };
  }, []);

  // Auto-close auth modal when sign-in completes
  useEffect(() => {
    if (userProfile) setAuthModalOpen(false);
  }, [userProfile]);

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
    setPaying(true);
    const totalPaisa = cart.reduce(
      (sum, item) => sum + item.item.pricePaisa * item.quantity,
      0
    );
    const now = new Date();
    const nextOrder: Order = {
      id: `order_${now.getTime()}`,
      token: Math.max(46, ...orders.map((order) => order.token)) + 1,
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
    window.setTimeout(() => {
      setOrders((current) => {
        const nextOrders = [nextOrder, ...current];
        writeOrders(nextOrders);
        return nextOrders;
      });
      setCart([]);
      setCartOpen(false);
      setPaying(false);
      router.push("/tokens");
    }, 700);
  }

  const studentOrders = userProfile
    ? orders.filter((order) => order.userId === userProfile.uid && order.status !== "cancelled")
    : [];
  const headerTokens = studentOrders
    .filter((order) => !["cancelled", "completed"].includes(order.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2);

  return (
    <div className="student-app">
      <main className="student-screen">
        <section className="student-hero">
          <div>
            <h1>Hey,</h1>
            <p>Ready to Order?</p>
          </div>
          {headerTokens.length > 0 ? (
            <button
              className="student-token-tray"
              onClick={() => router.push("/tokens")}
              title="Check on your orders!"
              type="button"
            >
              <span className="sr-only">Check on your orders!</span>
              {headerTokens.map((order) => (
                <span
                  className={order.status === "ready" ? "student-token ready" : "student-token"}
                  key={order.id}
                >
                  {order.token}
                </span>
              ))}
            </button>
          ) : null}
        </section>
        {!authReady ? (
          <div className="loading-screen">
            <div className="spinner" />
          </div>
        ) : null}
        <section className="workspace">
          <MenuGrid items={menu} onAdd={addToCart} />
        </section>
        <CartPanel
          cart={cart}
          onViewCart={() => setCartOpen(true)}
        />
        {cartOpen && (
          <CartReview
            cart={cart}
            signedIn={Boolean(userProfile)}
            phone={userProfile?.email || userProfile?.name || ""}
            paying={paying}
            onClose={() => setCartOpen(false)}
            onQuantityChange={updateQuantity}
            onOrderNow={placeDemoOrder}
            onSignIn={() => {
              setCartOpen(false);
              setAuthModalOpen(true);
            }}
            onAddMore={() => setCartOpen(false)}
          />
        )}
        {authModalOpen && !userProfile && (
          <div className="auth-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) setAuthModalOpen(false); }}>
            <div className="auth-modal">
              <button
                className="auth-modal-close"
                onClick={() => setAuthModalOpen(false)}
                type="button"
                aria-label="Close sign-in"
              >
                ✕
              </button>
              <AuthPanel
                title="Sign in to checkout"
                description="Sign in with Google to place your order. One tap, no passwords."
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
