import { MenuItem, Order } from "@/lib/types";

export const seedMenu: MenuItem[] = [
  {
    id: "masala-dosa",
    name: "Masala Dosa",
    description: "Crisp dosa with potato masala and chutney.",
    category: "meal",
    pricePaisa: 5500,
    available: true
  },
  {
    id: "veg-thali",
    name: "Veg Thali",
    description: "Rice, roti, dal, sabzi, curd, and pickle.",
    category: "meal",
    pricePaisa: 8500,
    available: true
  },
  {
    id: "samosa",
    name: "Samosa",
    description: "Two hot samosas with green chutney.",
    category: "snack",
    pricePaisa: 3000,
    available: true
  },
  {
    id: "paneer-roll",
    name: "Paneer Roll",
    description: "Paneer tikka, onions, and mint sauce in a wrap.",
    category: "snack",
    pricePaisa: 7000,
    available: false
  },
  {
    id: "filter-coffee",
    name: "Filter Coffee",
    description: "Fresh South Indian filter coffee.",
    category: "drink",
    pricePaisa: 2500,
    available: true
  },
  {
    id: "lime-soda",
    name: "Fresh Lime Soda",
    description: "Sweet, salted, or mixed.",
    category: "drink",
    pricePaisa: 3500,
    available: true
  }
];

const now = Date.now();

export const seedOrders: Order[] = [
  {
    id: "demo_order_1",
    token: 47,
    userId: "demo_9000000000",
    customerName: "Pranav",
    items: [
      { itemId: "masala-dosa", name: "Masala Dosa", pricePaisa: 5500, quantity: 1 },
      { itemId: "filter-coffee", name: "Filter Coffee", pricePaisa: 2500, quantity: 1 }
    ],
    totalPaisa: 8000,
    status: "placed",
    paymentStatus: "captured",
    createdAt: new Date(now - 3 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 3 * 60 * 1000).toISOString()
  },
  {
    id: "demo_order_2",
    token: 48,
    userId: "demo_9000000001",
    customerName: "Asha",
    items: [
      { itemId: "veg-thali", name: "Veg Thali", pricePaisa: 8500, quantity: 1 },
      { itemId: "lime-soda", name: "Fresh Lime Soda", pricePaisa: 3500, quantity: 1 }
    ],
    totalPaisa: 12000,
    status: "preparing",
    paymentStatus: "captured",
    createdAt: new Date(now - 11 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 7 * 60 * 1000).toISOString()
  },
  {
    id: "demo_order_3",
    token: 49,
    userId: "demo_9000000002",
    customerName: "Kabir",
    items: [
      { itemId: "samosa", name: "Samosa", pricePaisa: 3000, quantity: 2 }
    ],
    totalPaisa: 6000,
    status: "ready",
    paymentStatus: "captured",
    createdAt: new Date(now - 18 * 60 * 1000).toISOString(),
    updatedAt: new Date(now - 2 * 60 * 1000).toISOString()
  }
];
