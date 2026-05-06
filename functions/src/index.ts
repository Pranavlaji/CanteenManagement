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

/**
 * Timing-safe comparison of two hex-encoded HMAC signatures.
 * Prevents timing attacks that could leak signature bytes.
 */
function timingSafeHexEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
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
    .where("status", "in", ["placed", "preparing", "almost_ready", "ready"])
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

  // Timing-safe comparison to prevent signature byte leakage
  if (!timingSafeHexEqual(expected, payload.razorpay_signature)) {
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

  // Timing-safe comparison
  if (!timingSafeHexEqual(expected, signature)) {
    response.status(401).send("Unauthorized");
    return;
  }

  // Process webhook events
  const event = request.body?.event;
  const payload = request.body?.payload;

  if (event === "payment.captured" && payload?.payment?.entity) {
    const payment = payload.payment.entity;
    const razorpayOrderId = payment.order_id;
    const paymentId = payment.id;

    if (razorpayOrderId && paymentId) {
      try {
        // Look up the payment attempt to get the userId
        const attemptSnap = await db.collection("paymentAttempts").doc(razorpayOrderId).get();
        if (attemptSnap.exists) {
          const userId = attemptSnap.get("userId");
          if (userId) {
            await createConfirmedOrder(razorpayOrderId, userId, paymentId);
          }
        }
      } catch (err) {
        console.error("Webhook: failed to create order for captured payment:", err);
      }
    }
  } else if (event === "payment.failed") {
    const payment = payload?.payment?.entity;
    if (payment?.order_id) {
      // Mark payment attempt as failed
      await db.collection("paymentAttempts").doc(payment.order_id).update({
        status: "failed",
        failureReason: payment.error_description || "Unknown",
        updatedAt: FieldValue.serverTimestamp()
      }).catch(() => {
        // Attempt doc might not exist — that's fine
      });
    }
  }

  response.json({ ok: true });
});

/**
 * Generate the next sequential token number for the day.
 */
async function nextTokenNumber(): Promise<number> {
  const counterRef = db.collection("counters").doc("daily");
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(counterRef);
    const today = istDate();
    let lastToken = 0;
    if (snap.exists && snap.get("date") === today) {
      lastToken = Number(snap.get("lastToken") || 0);
    }
    const nextToken = lastToken + 1;
    tx.set(counterRef, {
      date: today,
      lastToken: nextToken,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return nextToken;
  });
}

async function createConfirmedOrder(razorpayOrderId: string, uid: string, paymentId: string) {
  const orderRef = db.collection("orders").doc(razorpayOrderId);
  try {
    // Look up payment attempt to get items and computed total
    const attemptSnap = await db.collection("paymentAttempts").doc(razorpayOrderId).get();
    const attemptData = attemptSnap.exists ? attemptSnap.data() : null;

    // Generate sequential token number
    const token = await nextTokenNumber();

    // Fetch user name
    const userSnap = await db.collection("users").doc(uid).get();
    const customerName = userSnap.exists
      ? String(userSnap.get("name") || "Student")
      : "Student";

    await orderRef.create({
      id: razorpayOrderId,
      token,
      userId: uid,
      customerName,
      items: attemptData?.items || [],
      totalPaisa: attemptData?.totalPaisa || 0,
      paymentId,
      status: "placed",
      paymentStatus: "captured",
      razorpayOrderId,
      razorpayPaymentId: paymentId,
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
    status: z.enum(["preparing", "almost_ready", "ready", "completed"])
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
