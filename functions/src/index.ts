import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { z } from "zod";

initializeApp();

const db = getFirestore();

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

export const assignRole = onCall({ enforceAppCheck: true }, async (request) => {
  requireRole(request, ["admin"]);
  const schema = z.object({
    uid: z.string().min(1),
    role: z.enum(["staff", "admin"])
  });
  const { uid, role } = schema.parse(request.data);
  await getAuth().setCustomUserClaims(uid, { role });
  await db.collection("users").doc(uid).set({
    role,
    roleDisplay: role,
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { ok: true };
});

export const updateOrderStatus = onCall({ enforceAppCheck: true }, async (request) => {
  const auth = requireRole(request, ["staff", "admin"]);
  const schema = z.object({
    orderId: z.string().min(1),
    status: z.enum(["preparing", "almost_ready", "ready", "completed"])
  });
  const { orderId, status } = schema.parse(request.data);
  const ref = db.collection("orders").doc(orderId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) {
      throw new HttpsError("not-found", "Order not found.");
    }
    const currentStatus = String(snap.get("status"));
    const transitions: Record<string, string[]> = {
      placed: ["preparing"],
      preparing: ["almost_ready"],
      almost_ready: ["ready"],
      ready: ["completed"]
    };
    if (!transitions[currentStatus]?.includes(status)) {
      throw new HttpsError("failed-precondition", "Invalid status transition.");
    }
    tx.update(ref, {
      status,
      updatedAt: FieldValue.serverTimestamp(),
      statusHistory: FieldValue.arrayUnion({
        status,
        changedBy: auth.uid,
        changedAt: new Date().toISOString()
      })
    });
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
