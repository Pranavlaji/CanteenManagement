import { MenuItem } from "@/lib/types";
import { db, isProduction } from "@/lib/firebase";
import { collection, onSnapshot } from "firebase/firestore";
import { seedMenu } from "@/lib/mock-data";

/**
 * Subscribe to real-time menu updates from Firestore.
 * Falls back to seedMenu only in local development.
 */
export function subscribeToMenu(callback: (items: MenuItem[]) => void) {
  if (!db) {
    callback(isProduction ? [] : seedMenu);
    return () => {};
  }

  return onSnapshot(
    collection(db, "menuItems"),
    (snapshot) => {
      if (snapshot.empty) {
        callback(isProduction ? [] : seedMenu);
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
      callback(isProduction ? [] : seedMenu);
    }
  );
}
