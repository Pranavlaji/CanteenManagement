import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";
import {
  verifyRequest,
  assertRateLimit,
  AuthError,
  adminDb,
  getRazorpayCredentials,
} from "@/lib/verify-auth";
import { seedMenu } from "@/lib/mock-data";
import { MenuItem } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

async function getMenuItemForCheckout(itemId: string): Promise<MenuItem | null> {
  const snap = await adminDb.collection("menuItems").doc(itemId).get();
  if (snap.exists) {
    const data = snap.data() || {};
    const pricePaisa = Number(data.pricePaisa || 0);
    if (!Number.isSafeInteger(pricePaisa) || pricePaisa < 100) {
      return null;
    }
    return {
      id: snap.id,
      name: String(data.name || ""),
      description: String(data.description || ""),
      category: data.category === "meal" || data.category === "drink" ? data.category : "snack",
      pricePaisa,
      available: data.available !== false,
      imageUrl: data.imageUrl || undefined,
    };
  }

  const menuSnapshot = await adminDb.collection("menuItems").limit(1).get();
  if (menuSnapshot.empty && process.env.NODE_ENV !== "production") {
    return seedMenu.find((item) => item.id === itemId) || null;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate — reject if no valid Firebase ID token
    const user = await verifyRequest(req);

    // 2. Rate limit — 6 requests per minute per user
    await assertRateLimit(user.uid, "createOrder", 6);

    // 3. Parse and validate cart items
    const body = await req.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0 || items.length > 10) {
      return NextResponse.json(
        { error: "Invalid cart. Must have 1-10 items." },
        { status: 400 }
      );
    }

    // 4. Server-side price computation — never trust client amounts
    let totalPaisa = 0;
    const validatedItems: Array<{
      itemId: string;
      name: string;
      pricePaisa: number;
      quantity: number;
    }> = [];

    for (const cartItem of items) {
      const { itemId, quantity } = cartItem;

      if (
        !itemId ||
        typeof itemId !== "string" ||
        itemId.length > 150 ||
        itemId.includes("/")
      ) {
        return NextResponse.json(
          { error: `Invalid item ID.` },
          { status: 400 }
        );
      }

      const qty = Number(quantity);
      if (!Number.isInteger(qty) || qty < 1 || qty > 5) {
        return NextResponse.json(
          { error: `Invalid quantity for ${itemId}. Must be 1-5.` },
          { status: 400 }
        );
      }

      // Look up item from Firestore, the production menu source of truth.
      const menuItem = await getMenuItemForCheckout(itemId);
      if (!menuItem) {
        return NextResponse.json(
          { error: `Item "${itemId}" not found on menu.` },
          { status: 400 }
        );
      }
      if (!menuItem.available) {
        return NextResponse.json(
          { error: `"${menuItem.name}" is currently unavailable.` },
          { status: 400 }
        );
      }

      totalPaisa += menuItem.pricePaisa * qty;
      if (!Number.isSafeInteger(totalPaisa)) {
        return NextResponse.json(
          { error: "Invalid order total." },
          { status: 400 }
        );
      }
      validatedItems.push({
        itemId: menuItem.id,
        name: menuItem.name,
        pricePaisa: menuItem.pricePaisa,
        quantity: qty,
      });
    }

    if (totalPaisa < 100) {
      return NextResponse.json(
        { error: "Order total must be at least ₹1 (100 paise)." },
        { status: 400 }
      );
    }

    // 5. Create Razorpay order with server-computed amount
    const razorpay = new Razorpay(getRazorpayCredentials());

    const order = await razorpay.orders.create({
      amount: totalPaisa,
      currency: "INR",
      receipt: `rcpt_${user.uid.slice(0, 8)}_${Date.now()}`,
      notes: {
        userId: user.uid,
        itemCount: String(validatedItems.length),
      },
    });

    await adminDb.collection("paymentAttempts").doc(order.id).set({
      userId: user.uid,
      razorpayOrderId: order.id,
      amountPaisa: totalPaisa,
      currency: "INR",
      items: validatedItems,
      status: "created",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 15 * 60_000),
    });

    return NextResponse.json(
      {
        ...order
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    if (error instanceof AuthError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("Create order error:", error);
    return NextResponse.json(
      { error: "Failed to create order. Please try again." },
      { status: 500 }
    );
  }
}
