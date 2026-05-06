import { Order, OrderStatus } from "@/lib/types";
import { db } from "@/lib/firebase";
import { collection, onSnapshot, query, where, orderBy, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

const ORDER_STORAGE_KEY = "canteen.demo.orders";

// --- DEMO / LOCAL STORAGE FALLBACK ---

export function readLocalOrders(fallback: Order[] = []) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(ORDER_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Order[]) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocalOrders(orders: Order[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("canteen-orders-updated"));
}

// --- FIRESTORE REAL-TIME SYNCS ---

function dateString(value: unknown) {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object" && "toDate" in value) {
    const date = (value as { toDate: () => Date }).toDate();
    return date.toISOString();
  }
  return new Date(0).toISOString();
}

function normalizeOrderDoc(doc: QueryDocumentSnapshot<DocumentData>): Order {
  const data = doc.data();
  return {
    id: doc.id,
    token: Number(data.token || 0),
    userId: String(data.userId || ""),
    customerName: String(data.customerName || "Student"),
    items: Array.isArray(data.items) ? data.items : [],
    totalPaisa: Number(data.totalPaisa || 0),
    status: data.status || "placed",
    paymentStatus: data.paymentStatus || "captured",
    razorpayOrderId: data.razorpayOrderId,
    razorpayPaymentId: data.razorpayPaymentId,
    createdAt: dateString(data.createdAt),
    updatedAt: dateString(data.updatedAt),
  };
}

export function subscribeToStaffOrders(callback: (orders: Order[]) => void) {
  if (!db) {
    // Fallback to local polling for demo
    callback(readLocalOrders());
    const sync = () => callback(readLocalOrders());
    window.addEventListener("storage", sync);
    window.addEventListener("canteen-orders-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("canteen-orders-updated", sync);
    };
  }

  // Real-time Firestore listener for kitchen staff
  const q = query(
    collection(db, "orders"),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(normalizeOrderDoc);
    callback(orders);
  }, (error) => {
    console.error("Staff orders listener error:", error);
  });
}

export function subscribeToStudentOrders(userId: string, callback: (orders: Order[]) => void) {
  if (!db) {
    // Fallback to local polling
    const sync = () => {
      const all = readLocalOrders();
      callback(all.filter(o => o.userId === userId));
    };
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("canteen-orders-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("canteen-orders-updated", sync);
    };
  }

  // Real-time Firestore listener for student
  const q = query(
    collection(db, "orders"),
    where("userId", "==", userId),
    orderBy("createdAt", "desc")
  );

  return onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs.map(normalizeOrderDoc);
    callback(orders);
  }, (error) => {
    console.error("Student orders listener error:", error);
  });
}

export async function updateOrderStatusInStore(orderId: string, status: OrderStatus) {
  if (!db) {
    const current = readLocalOrders();
    const next = current.map((order) =>
      order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
    );
    writeLocalOrders(next);
    return;
  }
  throw new Error("Order status updates must go through /api/orders/status.");
}
