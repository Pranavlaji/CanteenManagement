import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { adminAuth, adminDb, isValidHexSignature } from "@/lib/verify-auth";

const MAX_WEBHOOK_BODY_BYTES = 256 * 1024;

function istDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function nextTokenNumberInTransaction(tx: Transaction): Promise<number> {
  const counterRef = adminDb.collection("counters").doc("daily");
  const snap = await tx.get(counterRef);
  const today = istDate();
  const lastToken = snap.exists && snap.get("date") === today
    ? Number(snap.get("lastToken") || 0)
    : 0;
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
}

function verifyWebhookSignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex");

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function markPaymentFailed(payment: Record<string, unknown>) {
  const orderId = typeof payment.order_id === "string" ? payment.order_id : "";
  if (!orderId) return;

  const attemptRef = adminDb.collection("paymentAttempts").doc(orderId);
  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(attemptRef);
    if (!snap.exists) return;

    const status = String(snap.get("status") || "");
    if (status === "captured") return;

    tx.set(attemptRef, {
      status: "failed",
      failureReason: String(payment.error_description || "Payment failed."),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
}

async function finalizeCapturedPayment(payment: Record<string, unknown>) {
  const razorpayOrderId = typeof payment.order_id === "string" ? payment.order_id : "";
  const razorpayPaymentId = typeof payment.id === "string" ? payment.id : "";
  const amount = Number(payment.amount || 0);
  const currency = payment.currency;

  if (!razorpayOrderId || !razorpayPaymentId) {
    return;
  }

  const attemptRef = adminDb.collection("paymentAttempts").doc(razorpayOrderId);
  const orderRef = adminDb.collection("orders").doc(razorpayOrderId);
  const now = new Date();

  await adminDb.runTransaction(async (tx) => {
    const attemptSnap = await tx.get(attemptRef);
    if (!attemptSnap.exists) {
      console.error("Webhook payment attempt not found:", razorpayOrderId);
      return;
    }

    const attempt = attemptSnap.data() || {};
    if (attempt.status === "captured") {
      return;
    }

    const totalPaisa = Number(attempt.amountPaisa || 0);
    const items = attempt.items;
    if (
      attempt.status !== "created" ||
      amount !== totalPaisa ||
      currency !== "INR" ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      tx.set(attemptRef, {
        status: "verification_failed",
        failureReason: "Webhook payment details did not match the stored attempt.",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    const userId = String(attempt.userId || "");
    if (!userId) {
      tx.set(attemptRef, {
        status: "verification_failed",
        failureReason: "Payment attempt is missing a user id.",
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    const orderSnap = await tx.get(orderRef);
    if (orderSnap.exists) {
      tx.set(attemptRef, {
        status: "captured",
        razorpayPaymentId,
        capturedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    const token = await nextTokenNumberInTransaction(tx);
    const orderData = {
      id: razorpayOrderId,
      token,
      userId,
      customerName: String(attempt.customerName || "Student"),
      items,
      totalPaisa,
      status: "placed",
      paymentStatus: "captured",
      razorpayOrderId,
      razorpayPaymentId,
      businessDate: istDate(now),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    tx.create(orderRef, orderData);

    tx.set(attemptRef, {
      status: "captured",
      razorpayPaymentId,
      capturedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  try {
    const orderSnap = await orderRef.get();
    const order = orderSnap.data();
    if (order?.userId && order.customerName === "Student") {
      const user = await adminAuth.getUser(String(order.userId));
      const customerName = user.email || user.displayName || "Student";
      await orderRef.set({ customerName }, { merge: true });
    }
  } catch {
    // Customer display name enrichment is best-effort.
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret || secret.length < 16) {
    console.error("RAZORPAY_WEBHOOK_SECRET is missing or too short.");
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  if (!isValidHexSignature(signature)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await req.text();
  if (Buffer.byteLength(rawBody, "utf8") > MAX_WEBHOOK_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large." }, { status: 413 });
  }
  if (!verifyWebhookSignature(rawBody, signature, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const event = JSON.parse(rawBody) as {
      event?: string;
      payload?: {
        payment?: {
          entity?: Record<string, unknown>;
        };
      };
    };
    const payment = event.payload?.payment?.entity;

    if (event.event === "payment.captured" && payment) {
      await finalizeCapturedPayment(payment);
    }

    if (event.event === "payment.failed" && payment) {
      await markPaymentFailed(payment);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Razorpay webhook error:", error);
    return NextResponse.json({ error: "Webhook processing failed." }, { status: 500 });
  }
}
