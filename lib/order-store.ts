import { Order, OrderStatus } from "@/lib/types";
import { db } from "@/lib/firebase";
import { collection, doc, onSnapshot, query, setDoc, updateDoc, where, serverTimestamp, orderBy } from "firebase/firestore";

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
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data() as Order;
      // Filter out cancelled/completed older than 24h if needed, 
      // but for now return all and let UI filter
      orders.push(data);
    });
    callback(orders);
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
    const orders: Order[] = [];
    snapshot.forEach((doc) => {
      orders.push(doc.data() as Order);
    });
    callback(orders);
  });
}

// --- FIRESTORE WRITES ---

export async function createOrderInStore(order: Order) {
  if (!db) {
    const current = readLocalOrders();
    writeLocalOrders([order, ...current]);
    return;
  }

  await setDoc(doc(db, "orders", order.id), {
    ...order,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
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

  await updateDoc(doc(db, "orders", orderId), {
    status,
    updatedAt: serverTimestamp()
  });
}
