import { MenuItem } from "@/lib/types";
import { db } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { seedMenu } from "@/lib/mock-data";

/**
 * Subscribe to real-time menu updates from Firestore.
 * Falls back to seedMenu when Firestore is unavailable.
 */
export function subscribeToMenu(callback: (items: MenuItem[]) => void) {
  if (!db) {
    // No Firestore — use static seed data
    callback(seedMenu);
    return () => {};
  }

  return onSnapshot(
    collection(db, "menuItems"),
    (snapshot) => {
      if (snapshot.empty) {
        // Collection doesn't exist yet or is empty — fall back to seed
        callback(seedMenu);
        return;
      }

      const items: MenuItem[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        items.push({
          id: doc.id,
          name: String(data.name || ""),
          description: String(data.description || ""),
          category: data.category || "snack",
          pricePaisa: Number(data.pricePaisa || 0),
          available: data.available !== false,
          imageUrl: data.imageUrl || undefined,
        });
      });
      callback(items);
    },
    (error) => {
      console.error("Menu listener error:", error);
      // Fall back to seed data on error
      callback(seedMenu);
    }
  );
}
