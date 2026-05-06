import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, isValidHexSignature } from "@/lib/verify-auth";

function istDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

async function nextTokenNumber(): Promise<number> {
  const counterRef = adminDb.collection("counters").doc("daily");

  return adminDb.runTransaction(async (tx) => {
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
  });
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

  await adminDb.collection("paymentAttempts").doc(orderId).set({
    status: "failed",
    failureReason: String(payment.error_description || "Payment failed."),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
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
  const attemptSnap = await attemptRef.get();
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
    await attemptRef.set({
      status: "verification_failed",
      failureReason: "Webhook payment details did not match the stored attempt.",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  const userId = String(attempt.userId || "");
  if (!userId) {
    await attemptRef.set({
      status: "verification_failed",
      failureReason: "Payment attempt is missing a user id.",
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return;
  }

  const token = await nextTokenNumber();
  const now = new Date();
  let customerName = "Student";
  try {
    const user = await adminAuth.getUser(userId);
    customerName = user.email || user.displayName || customerName;
  } catch {
    customerName = String(attempt.customerName || customerName);
  }

  const orderData = {
    id: razorpayOrderId,
    token,
    userId,
    customerName,
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

  const orderRef = adminDb.collection("orders").doc(razorpayOrderId);
  try {
    await orderRef.create(orderData);
  } catch (error) {
    const message = String(error);
    if (!message.includes("ALREADY_EXISTS") && !message.includes("already exists")) {
      throw error;
    }
  }

  await attemptRef.set({
    status: "captured",
    razorpayPaymentId,
    capturedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
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
