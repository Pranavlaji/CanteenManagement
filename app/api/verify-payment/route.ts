import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  verifyRequest,
  assertRateLimit,
  AuthError,
  adminDb,
} from "@/lib/verify-auth";
import { FieldValue } from "firebase-admin/firestore";

/**
 * IST date string for business-day partitioning (e.g. "2026-05-06").
 */
function istDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/**
 * Atomically increment the daily token counter and return the next token number.
 * Resets each day via the `resetDailyCounter` Cloud Function.
 */
async function nextTokenNumber(): Promise<number> {
  const counterRef = adminDb.collection("counters").doc("daily");

  return adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const today = istDate();
    let lastToken = 0;

    if (snap.exists && snap.get("date") === today) {
      lastToken = Number(snap.get("lastToken") || 0);
    }

    const nextToken = lastToken + 1;

    tx.set(
      counterRef,
      {
        date: today,
        lastToken: nextToken,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return nextToken;
  });
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate
    const user = await verifyRequest(req);

    // 2. Rate limit
    assertRateLimit(user.uid, "verifyPayment", 6);

    // 3. Parse and validate payload
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      items,
      totalPaisa,
      customerName,
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing required payment fields." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Missing order items." },
        { status: 400 }
      );
    }

    if (!totalPaisa || typeof totalPaisa !== "number" || totalPaisa < 100) {
      return NextResponse.json(
        { error: "Invalid order total." },
        { status: 400 }
      );
    }

    // 4. Verify Razorpay signature — timing-safe comparison
    const secret = process.env.RAZORPAY_KEY_SECRET || "";
    if (!secret) {
      console.error("RAZORPAY_KEY_SECRET is not configured.");
      return NextResponse.json(
        { error: "Payment configuration error." },
        { status: 500 }
      );
    }

    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const a = Buffer.from(expectedSignature, "hex");
    const b = Buffer.from(razorpay_signature, "hex");

    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return NextResponse.json(
        { error: "Invalid signature. Payment verification failed." },
        { status: 400 }
      );
    }

    // 5. Generate sequential token number (server-side, collision-free)
    const token = await nextTokenNumber();

    // 6. Create order in Firestore using Admin SDK (bypasses security rules)
    const orderId = razorpay_order_id; // Use Razorpay order ID — globally unique
    const now = new Date();
    const orderData = {
      id: orderId,
      token,
      userId: user.uid,
      customerName: customerName || "Student",
      items,
      totalPaisa,
      status: "placed",
      paymentStatus: "captured",
      razorpayOrderId: razorpay_order_id,
      razorpayPaymentId: razorpay_payment_id,
      businessDate: istDate(now),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const orderRef = adminDb.collection("orders").doc(orderId);

    try {
      await orderRef.create(orderData);
    } catch (err: unknown) {
      // Handle idempotency — if order already exists, return it
      const errStr = String(err);
      if (
        errStr.includes("ALREADY_EXISTS") ||
        errStr.includes("already exists")
      ) {
        const existing = await orderRef.get();
        return NextResponse.json(
          {
            success: true,
            order: { id: existing.id, ...existing.data() },
            alreadyExists: true,
          },
          { status: 200 }
        );
      }
      throw err;
    }

    // 7. Return created order to client
    return NextResponse.json(
      {
        success: true,
        order: {
          ...orderData,
          // Replace server timestamps with ISO strings for the client
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        },
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
    console.error("Verify payment error:", error);
    const message =
      error instanceof Error ? error.message : "Payment verification failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
