"use client";

import { AuthPanel } from "@/components/auth-panel";
import { CartPanel } from "@/components/cart-panel";
import { CartReview } from "@/components/cart-review";
import { MenuGrid } from "@/components/menu-grid";
import { useAuth } from "@/components/auth-provider";
import { seedMenu } from "@/lib/mock-data";
import { subscribeToStudentOrders, createOrderInStore } from "@/lib/order-store";
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
    if (!userProfile) {
      setOrders([]);
      return;
    }
    const unsubscribe = subscribeToStudentOrders(userProfile.uid, (fetchedOrders) => {
      setOrders(fetchedOrders);
    });
    return () => unsubscribe();
  }, [userProfile]);

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

  async function placeRazorpayOrder() {
    if (!userProfile || cart.length === 0) return;
    setPaying(true);

    const totalPaisa = cart.reduce(
      (sum, item) => sum + item.item.pricePaisa * item.quantity,
      0
    );

    try {
      // 1. Create order on backend
      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: totalPaisa }),
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
            // 4. Verify payment signature on backend
            const verifyRes = await fetch("/api/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            const verifyData = await verifyRes.json();

            if (!verifyRes.ok) {
              throw new Error(verifyData.error || "Payment verification failed");
            }

            // 5. Success! Save to Firestore
            const now = new Date();
            const nextOrder: Order = {
              id: `order_${now.getTime()}`,
              token: Math.floor(Math.random() * 900) + 100, // 3-digit random token
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
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              createdAt: now.toISOString(),
              updatedAt: now.toISOString()
            };

            // Optimistic UI update
            setOrders((current) => [nextOrder, ...current]);
            setCart([]);
            setCartOpen(false);
            
            // Save to Firestore
            await createOrderInStore(nextOrder);
            
            setPaying(false);
            router.push("/tokens");
          } catch (verifyError) {
            console.error("Payment verification failed", verifyError);
            alert("Payment verification failed. Please contact support.");
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
        alert(`Payment Failed: ${response.error.description}`);
        setPaying(false);
      });

      // Handle user closing the modal
      paymentObject.on("payment.modal.closed", function () {
        setPaying(false);
      });

      paymentObject.open();

    } catch (error) {
      console.error("Checkout error:", error);
      alert(error instanceof Error ? error.message : "Failed to initiate payment");
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
