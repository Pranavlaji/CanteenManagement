import { Order, OrderStatus } from "@/lib/types";

const ORDER_STORAGE_KEY = "canteen.demo.orders";

export function readOrders(fallback: Order[] = []) {
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

export function writeOrders(orders: Order[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orders));
  window.dispatchEvent(new Event("canteen-orders-updated"));
}

export function updateOrderStatus(orders: Order[], orderId: string, status: OrderStatus) {
  return orders.map((order) =>
    order.id === orderId ? { ...order, status, updatedAt: new Date().toISOString() } : order
  );
}
