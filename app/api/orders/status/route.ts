import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AuthError, adminDb, requireRole } from "@/lib/verify-auth";
import { OrderStatus } from "@/lib/types";

const allowedTransitions: Partial<Record<OrderStatus, OrderStatus[]>> = {
  placed: ["preparing"],
  preparing: ["almost_ready"],
  almost_ready: ["ready"],
  ready: ["completed"],
};

export async function POST(req: NextRequest) {
  try {
    const user = await requireRole(req, ["staff", "admin"]);
    const body = await req.json();
    const orderId = typeof body.orderId === "string" ? body.orderId.trim() : "";
    const nextStatus = body.status as OrderStatus;

    if (!orderId || !["preparing", "almost_ready", "ready", "completed"].includes(nextStatus)) {
      return NextResponse.json({ error: "Invalid order status update." }, { status: 400 });
    }

    const ref = adminDb.collection("orders").doc(orderId);
    const updatedOrder = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists) {
        throw new AuthError("Order not found.", 404);
      }
      const currentStatus = snap.get("status") as OrderStatus;
      if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
        throw new AuthError("Invalid order status transition.", 400);
      }
      const patch = {
        status: nextStatus,
        updatedAt: FieldValue.serverTimestamp(),
        statusHistory: FieldValue.arrayUnion({
          status: nextStatus,
          changedBy: user.uid,
          changedAt: new Date().toISOString(),
        }),
      };
      tx.update(ref, patch);
      return {
        id: snap.id,
        ...snap.data(),
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      };
    });

    return NextResponse.json({ ok: true, order: updatedOrder });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Order status update error:", error);
    return NextResponse.json({ error: "Failed to update order status." }, { status: 500 });
  }
}
