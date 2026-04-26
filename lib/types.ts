export type Role = "student" | "staff" | "admin";

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: "meal" | "snack" | "drink";
  pricePaisa: number;
  available: boolean;
  imageUrl?: string;
};

export type CartItem = {
  item: MenuItem;
  quantity: number;
};

export type OrderStatus = "placed" | "preparing" | "ready" | "completed" | "cancelled";

export type Order = {
  id: string;
  token: number;
  userId: string;
  customerName: string;
  items: Array<{
    itemId: string;
    name: string;
    pricePaisa: number;
    quantity: number;
  }>;
  totalPaisa: number;
  status: OrderStatus;
  paymentStatus: "captured" | "refunded" | "refund_pending" | "refund_failed";
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  createdAt: string;
  updatedAt: string;
};

export type UserProfile = {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
};
