"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetDailyCounter = exports.updateOrderStatus = exports.assignRole = void 0;
const app_1 = require("firebase-admin/app");
const auth_1 = require("firebase-admin/auth");
const firestore_1 = require("firebase-admin/firestore");
const https_1 = require("firebase-functions/v2/https");
const scheduler_1 = require("firebase-functions/v2/scheduler");
const zod_1 = require("zod");
(0, app_1.initializeApp)();
const db = (0, firestore_1.getFirestore)();
function requireAuth(request) {
    if (!request.auth?.uid) {
        throw new https_1.HttpsError("unauthenticated", "Sign in required.");
    }
    return request.auth;
}
function requireRole(request, roles) {
    const auth = requireAuth(request);
    const role = auth.token.role || "student";
    if (!roles.includes(String(role))) {
        throw new https_1.HttpsError("permission-denied", "Insufficient role.");
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
exports.assignRole = (0, https_1.onCall)({ enforceAppCheck: true }, async (request) => {
    requireRole(request, ["admin"]);
    const schema = zod_1.z.object({
        uid: zod_1.z.string().min(1),
        role: zod_1.z.enum(["staff", "admin"])
    });
    const { uid, role } = schema.parse(request.data);
    await (0, auth_1.getAuth)().setCustomUserClaims(uid, { role });
    await db.collection("users").doc(uid).set({
        role,
        roleDisplay: role,
        updatedAt: firestore_1.FieldValue.serverTimestamp()
    }, { merge: true });
    return { ok: true };
});
exports.updateOrderStatus = (0, https_1.onCall)({ enforceAppCheck: true }, async (request) => {
    const auth = requireRole(request, ["staff", "admin"]);
    const schema = zod_1.z.object({
        orderId: zod_1.z.string().min(1),
        status: zod_1.z.enum(["preparing", "almost_ready", "ready", "completed"])
    });
    const { orderId, status } = schema.parse(request.data);
    const ref = db.collection("orders").doc(orderId);
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) {
            throw new https_1.HttpsError("not-found", "Order not found.");
        }
        const currentStatus = String(snap.get("status"));
        const transitions = {
            placed: ["preparing"],
            preparing: ["almost_ready"],
            almost_ready: ["ready"],
            ready: ["completed"]
        };
        if (!transitions[currentStatus]?.includes(status)) {
            throw new https_1.HttpsError("failed-precondition", "Invalid status transition.");
        }
        tx.update(ref, {
            status,
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
            statusHistory: firestore_1.FieldValue.arrayUnion({
                status,
                changedBy: auth.uid,
                changedAt: new Date().toISOString()
            })
        });
    });
    return { ok: true };
});
exports.resetDailyCounter = (0, scheduler_1.onSchedule)({
    schedule: "every day 00:00",
    timeZone: "Asia/Kolkata"
}, async () => {
    const today = istDate();
    await db.collection("counters").doc("daily").set({
        date: today,
        lastToken: 0,
        updatedAt: firestore_1.FieldValue.serverTimestamp()
    });
});
//# sourceMappingURL=index.js.map