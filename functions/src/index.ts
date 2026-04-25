import crypto from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";

initializeApp();

const db = getFirestore();

const cartSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().min(1),
      quantity: z.number().int().min(1).max(5)
    })
  ).min(1).max(10)
});

function requireAuth(request: { auth?: { uid: string; token: Record<string, unknown> } }) {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  return request.auth;
}

function requireRole(
  request: { auth?: { uid: string; token: Record<string, unknown> } },
  roles: string[]
) {
  const auth = requireAuth(request);
  const role = auth.token.role || "student";
  if (!roles.includes(String(role))) {
    throw new HttpsError("permission-denied", "Insufficient role.");
  }
  return auth;
}

function istDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

async function assertRateLimit(uid: string, key: string, maxPerMinute: number) {
  const id = `${uid}_${key}_${Math.floor(Date.now() / 60_000)}`;
  const ref = db.collection("rateLimits").doc(id);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = snap.exists ? Number(snap.get("count") || 0) : 0;
    if (count >= maxPerMinute) {
      throw new HttpsError("resource-exhausted", "Too many attempts. Try again shortly.");
    }
    tx.set(ref, {
      uid,
      key,
      count: count + 1,
      expiresAt: new Date(Date.now() + 10 * 60_000)
    }, { merge: true });
  });
}

export const assignRole = onCall(async (request) => {
  requireRole(request, ["admin"]);
  const schema = z.object({
    uid: z.string().min(1),
    role: z.enum(["staff", "admin"])
  });
  const { uid, role } = schema.parse(request.data);
  await getAuth().setCustomUserClaims(uid, { role });
  await db.collection("users").doc(uid).set({
    roleDisplay: role,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

export const initiatePayment = onCall(async (request) => {
  const auth = requireAuth(request);
  await assertRateLimit(auth.uid, "initiatePayment", 6);
  const { items } = cartSchema.parse(request.data);

  const active = await db.collection("orders")
    .where("userId", "==", auth.uid)
    .where("status", "in", ["placed", "preparing", "ready"])
    .limit(1)
    .get();
  if (!active.empty) {
    throw new HttpsError("failed-precondition", "Complete your active order before placing another.");
  }

  // TODO: Fetch menuItems, validate availability/prices, compute totalPaisa,
  // then create a Razorpay order with the secret key from Secret Manager.
  const razorpayOrderId = `demo_${Date.now()}_${auth.uid}`;
  await db.collection("paymentAttempts").doc(razorpayOrderId).set({
    userId: auth.uid,
    items,
    status: "initiated",
    businessDate: istDate(),
    createdAt: FieldValue.serverTimestamp()
  });

  return {
    razorpayOrderId,
    keyId: process.env.RAZORPAY_KEY_ID || "configure_secret",
    amountPaisa: 0
  };
});

export const verifyPayment = onCall(async (request) => {
  const auth = requireAuth(request);
  const schema = z.object({
    razorpay_order_id: z.string().min(1),
    razorpay_payment_id: z.string().min(1),
    razorpay_signature: z.string().min(1)
  });
  const payload = schema.parse(request.data);
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new HttpsError("failed-precondition", "Payment secret is not configured.");
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${payload.razorpay_order_id}|${payload.razorpay_payment_id}`)
    .digest("hex");
  if (expected !== payload.razorpay_signature) {
    throw new HttpsError("permission-denied", "Payment verification failed.");
  }

  return createConfirmedOrder(payload.razorpay_order_id, auth.uid, payload.razorpay_payment_id);
});

export const razorpayWebhook = onRequest(async (request, response) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = request.get("x-razorpay-signature");
  if (!secret || !signature) {
    response.status(401).send("Unauthorized");
    return;
  }
  const body = JSON.stringify(request.body);
  const expected = crypto.createHmac("sha256", secret).update(body).digest("hex");
  if (expected !== signature) {
    response.status(401).send("Unauthorized");
    return;
  }
  // TODO: Handle payment.captured/refund events with createConfirmedOrder.
  response.json({ ok: true });
});

async function createConfirmedOrder(razorpayOrderId: string, uid: string, paymentId: string) {
  const orderRef = db.collection("orders").doc(razorpayOrderId);
  try {
    await orderRef.create({
      orderId: razorpayOrderId,
      userId: uid,
      paymentId,
      status: "placed",
      paymentStatus: "captured",
      businessDate: istDate(),
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  } catch (error) {
    if (String(error).includes("ALREADY_EXISTS") || String(error).includes("already exists")) {
      const existing = await orderRef.get();
      return { orderId: existing.id, alreadyExists: true };
    }
    throw error;
  }
  return { orderId: razorpayOrderId, alreadyExists: false };
}

export const cancelOrder = onCall(async (request) => {
  const auth = requireAuth(request);
  const schema = z.object({ orderId: z.string().min(1) });
  const { orderId } = schema.parse(request.data);
  const ref = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists || snap.get("userId") !== auth.uid) {
      throw new HttpsError("not-found", "Order not found.");
    }
    if (snap.get("status") !== "placed") {
      throw new HttpsError("failed-precondition", "This order can no longer be cancelled.");
    }
    const createdAt = snap.get("createdAt")?.toDate?.() as Date | undefined;
    if (createdAt && Date.now() - createdAt.getTime() > 90_000) {
      throw new HttpsError("failed-precondition", "Cancellation window has closed.");
    }
    tx.update(ref, {
      status: "cancelled",
      paymentStatus: "refund_pending",
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  // TODO: call Razorpay refund API and update refund status.
  return { ok: true };
});

export const updateOrderStatus = onCall(async (request) => {
  const auth = requireRole(request, ["staff", "admin"]);
  const schema = z.object({
    orderId: z.string().min(1),
    status: z.enum(["preparing", "ready", "completed"])
  });
  const { orderId, status } = schema.parse(request.data);
  await db.collection("orders").doc(orderId).update({
    status,
    updatedAt: FieldValue.serverTimestamp(),
    statusHistory: FieldValue.arrayUnion({
      status,
      changedBy: auth.uid,
      changedAt: new Date().toISOString()
    })
  });
  return { ok: true };
});

export const resetDailyCounter = onSchedule({
  schedule: "every day 00:00",
  timeZone: "Asia/Kolkata"
}, async () => {
  const today = istDate();
  await db.collection("counters").doc("daily").set({
    date: today,
    lastToken: 0,
    updatedAt: FieldValue.serverTimestamp()
  });
});
