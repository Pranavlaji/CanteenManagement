"use client";

import { AuthPanel } from "@/components/auth-panel";
import { CartPanel } from "@/components/cart-panel";
import { CartReview } from "@/components/cart-review";
import { MenuGrid } from "@/components/menu-grid";
import { useAuth } from "@/components/auth-provider";
import { subscribeToMenu } from "@/lib/menu-store";
import { subscribeToStudentOrders } from "@/lib/order-store";
import { CartItem, MenuItem, Order } from "@/lib/types";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function Home() {
  const { authReady, userProfile, getIdToken } = useAuth();
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [menu, setMenu] = useState<MenuItem[]>([]);

  // Subscribe to real-time menu from Firestore
  useEffect(() => {
    const unsubscribe = subscribeToMenu((items) => {
      setMenu(items);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const availableIds = new Set(menu.filter((item) => item.available).map((item) => item.id));
    setCart((current) => current.filter((cartItem) => availableIds.has(cartItem.item.id)));
  }, [menu]);

  useEffect(() => {
    if (!userProfile) {
      setOrders([]);
      return;
    }
    const unsubscribe = subscribeToStudentOrders(userProfile.uid, (fetchedOrders) => {
      setOrders(fetchedOrders);
    });
    return () => unsubscribe();
  }, [userProfile]);

  // Auto-close auth modal and reopen cart when sign-in completes
  useEffect(() => {
    if (userProfile && authModalOpen) {
      setAuthModalOpen(false);
      setCartOpen(true);
    }
  }, [userProfile, authModalOpen]);

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

  async function placeRazorpayOrder() {
    if (!userProfile || cart.length === 0) return;
    setPaying(true);
    setPaymentError(null);

    try {
      // Get Firebase ID token for authenticated API calls
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error("Please sign in again to continue.");
      }

      const authHeaders = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      };

      // 1. Create order on backend — server validates prices
      const cartItems = cart.map((cartItem) => ({
        itemId: cartItem.item.id,
        quantity: cartItem.quantity,
      }));

      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify({ items: cartItems }),
      });
      const orderData = await res.json();

      if (!res.ok) {
        throw new Error(orderData.error || "Failed to create order");
      }

      // 2. Load Razorpay script dynamically
      const loadScript = () => {
        return new Promise((resolve) => {
          if ((window as any).Razorpay) {
            resolve(true);
            return;
          }
          const script = document.createElement("script");
          script.src = "https://checkout.razorpay.com/v1/checkout.js";
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const resLoaded = await loadScript();
      if (!resLoaded) {
        throw new Error("Razorpay SDK failed to load. Please check your connection.");
      }

      // 3. Initialize Razorpay options
      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Canteen Checkout",
        description: "Food Order",
        order_id: orderData.id,
        handler: async function (response: any) {
          try {
            // 4. Verify payment and create order SERVER-SIDE
            // Get a fresh token in case the old one expired during payment
            const freshToken = await getIdToken();
            const totalPaisa = orderData._totalPaisa;

            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${freshToken}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                // Server uses these to create the order document
                items: orderData._validatedItems,
                totalPaisa,
                customerName: userProfile.name,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              throw new Error(verifyData.error || "Payment verification failed");
            }

            // 5. Server created the order — use its response for optimistic update
            const serverOrder = verifyData.order as Order;
            setOrders((current) => [serverOrder, ...current]);
            setCart([]);
            setCartOpen(false);
            setPaying(false);
            router.push("/tokens");
          } catch (verifyError) {
            console.error("Payment verification failed:", verifyError);
            setPaymentError(
              verifyError instanceof Error
                ? verifyError.message
                : "Payment verification failed. Please contact support."
            );
            setPaying(false);
          }
        },
        prefill: {
          name: userProfile.name,
          email: userProfile.email || "student@canteen.internal",
          contact: userProfile.phone || "",
        },
        theme: {
          color: "#0f172a", // Match your app theme
        },
      };

      const paymentObject = new (window as any).Razorpay(options);
      
      paymentObject.on("payment.failed", function (response: any) {
        setPaymentError(`Payment Failed: ${response.error.description}`);
        setPaying(false);
      });

      // Handle user closing the modal
      paymentObject.on("payment.modal.closed", function () {
        setPaying(false);
      });

      paymentObject.open();

    } catch (error) {
      console.error("Checkout error:", error);
      setPaymentError(
        error instanceof Error ? error.message : "Failed to initiate payment"
      );
      setPaying(false);
    }
  }

  const studentOrders = userProfile
    ? orders.filter((order) => order.userId === userProfile.uid && order.status !== "cancelled")
    : [];
  const headerTokens = studentOrders
    .filter((order) => !["cancelled", "completed"].includes(order.status))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 2);

  if (!authReady) {
    return (
      <div className="student-app">
        <div className="loading-screen">
          <div className="spinner" />
        </div>
      </div>
    );
  }

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
                  className={
                    order.status === "ready" 
                      ? "student-token ready" 
                      : order.status === "almost_ready"
                        ? "student-token almost_ready"
                        : "student-token"
                  }
                  key={order.id}
                >
                  {order.token}
                </span>
              ))}
            </button>
          ) : null}
        </section>

        {/* Payment error banner */}
        {paymentError ? (
          <div
            className="payment-error-banner"
            style={{
              margin: "0 1rem",
              padding: "0.75rem 1rem",
              background: "#7f1d1d",
              color: "#fecaca",
              borderRadius: "0.5rem",
              fontSize: "0.9rem",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <span>{paymentError}</span>
            <button
              onClick={() => setPaymentError(null)}
              style={{
                background: "none",
                border: "none",
                color: "#fecaca",
                cursor: "pointer",
                fontSize: "1.1rem",
                padding: "0 0.25rem",
              }}
              type="button"
              aria-label="Dismiss error"
            >
              ✕
            </button>
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
            onOrderNow={placeRazorpayOrder}
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
