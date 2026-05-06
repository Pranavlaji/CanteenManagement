import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import Razorpay from "razorpay";
import {
  verifyRequest,
  assertRateLimit,
  AuthError,
  adminDb,
  getRazorpayCredentials,
  isValidHexSignature,
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
    await assertRateLimit(user.uid, "verifyPayment", 6);

    // 3. Parse and validate payload
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body;

    if (
      typeof razorpay_order_id !== "string" ||
      typeof razorpay_payment_id !== "string" ||
      typeof razorpay_signature !== "string" ||
      !razorpay_order_id ||
      !razorpay_payment_id ||
      !razorpay_signature
    ) {
      return NextResponse.json(
        { error: "Missing required payment fields." },
        { status: 400 }
      );
    }
    if (!isValidHexSignature(razorpay_signature)) {
      return NextResponse.json(
        { error: "Invalid signature. Payment verification failed." },
        { status: 400 }
      );
    }

    // 4. Verify Razorpay signature — timing-safe comparison
    const credentials = getRazorpayCredentials();

    const expectedSignature = crypto
      .createHmac("sha256", credentials.key_secret)
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

    const attemptRef = adminDb.collection("paymentAttempts").doc(razorpay_order_id);
    const attemptSnap = await attemptRef.get();
    if (!attemptSnap.exists) {
      return NextResponse.json(
        { error: "Payment attempt not found." },
        { status: 404 }
      );
    }

    const attempt = attemptSnap.data() || {};
    if (attempt.userId !== user.uid) {
      return NextResponse.json(
        { error: "Payment attempt does not belong to this user." },
        { status: 403 }
      );
    }

    if (attempt.status === "captured") {
      const existing = await adminDb.collection("orders").doc(razorpay_order_id).get();
      return NextResponse.json(
        {
          success: true,
          order: { id: existing.id, ...existing.data() },
          alreadyExists: true,
        },
        { status: 200 }
      );
    }

    if (attempt.status !== "created") {
      return NextResponse.json(
        { error: "Payment attempt is not payable." },
        { status: 400 }
      );
    }
    const expiresAt = attempt.expiresAt;
    if (expiresAt && typeof expiresAt.toDate === "function" && expiresAt.toDate().getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Payment attempt expired. Please start checkout again." },
        { status: 400 }
      );
    }

    const items = attempt.items;
    const totalPaisa = Number(attempt.amountPaisa || 0);
    if (!Array.isArray(items) || items.length === 0 || totalPaisa < 100) {
      return NextResponse.json(
        { error: "Stored payment attempt is invalid." },
        { status: 500 }
      );
    }

    const razorpay = new Razorpay(credentials);
    const payment = await razorpay.payments.fetch(razorpay_payment_id) as {
      amount?: number;
      currency?: string;
      order_id?: string;
      status?: string;
    };
    if (
      payment.order_id !== razorpay_order_id ||
      Number(payment.amount || 0) !== totalPaisa ||
      payment.currency !== "INR" ||
      payment.status !== "captured"
    ) {
      await attemptRef.set({
        status: "verification_failed",
        failureReason: "Razorpay payment details did not match the stored attempt.",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return NextResponse.json(
        { error: "Payment details did not match the order." },
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
      customerName: user.email || "Student",
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
      await attemptRef.set({
        status: "captured",
        razorpayPaymentId: razorpay_payment_id,
        capturedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
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
    return NextResponse.json(
      { error: "Payment verification failed. Please contact support if payment was debited." },
      { status: 500 }
    );
  }
}
