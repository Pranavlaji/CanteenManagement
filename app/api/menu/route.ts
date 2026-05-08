import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { AuthError, adminDb, requireRole } from "@/lib/verify-auth";
import { MenuItem } from "@/lib/types";

const categories = ["meal", "snack", "drink"] as const;

function isValidItemId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 150 && !value.includes("/");
}

function parseMenuItem(value: unknown): Omit<MenuItem, "id"> | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const name = String(raw.name || "").trim();
  const description = String(raw.description || "").trim();
  const category = raw.category;
  const pricePaisa = Number(raw.pricePaisa);
  const available = raw.available !== false;
  const imageUrl = typeof raw.imageUrl === "string" ? raw.imageUrl.trim() : "";

  if (!name || name.length > 80) return null;
  if (description.length > 240) return null;
  if (!categories.includes(category as (typeof categories)[number])) return null;
  if (!Number.isInteger(pricePaisa) || pricePaisa < 100 || pricePaisa > 100000) return null;
  if (
    imageUrl &&
    (imageUrl.length > 500 ||
      (!imageUrl.startsWith("/") && !imageUrl.startsWith("https://")))
  ) return null;

  return {
    name,
    description,
    category: category as MenuItem["category"],
    pricePaisa,
    available,
    ...(imageUrl ? { imageUrl } : {}),
  };
}

export async function POST(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const item = parseMenuItem(await req.json());
    if (!item) {
      return NextResponse.json({ error: "Invalid menu item." }, { status: 400 });
    }

    const ref = await adminDb.collection("menuItems").add({
      ...item,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return NextResponse.json({ id: ref.id, ...item }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Menu add error:", error);
    return NextResponse.json({ error: "Failed to add menu item." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { itemId, action } = body;
    if (!isValidItemId(itemId)) {
      return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
    }

    if (action === "availability") {
      await requireRole(req, ["staff", "admin"]);
      if (typeof body.available !== "boolean") {
        return NextResponse.json({ error: "Invalid availability." }, { status: 400 });
      }
      const ref = adminDb.collection("menuItems").doc(itemId);
      const snap = await ref.get();
      if (!snap.exists) {
        return NextResponse.json({ error: "Menu item not found." }, { status: 404 });
      }
      await ref.update({
        available: body.available,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "price") {
      await requireRole(req, ["admin"]);
      const pricePaisa = Number(body.pricePaisa);
      if (!Number.isInteger(pricePaisa) || pricePaisa < 100 || pricePaisa > 100000) {
        return NextResponse.json({ error: "Invalid price." }, { status: 400 });
      }
      await adminDb.collection("menuItems").doc(itemId).update({
        pricePaisa,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid menu action." }, { status: 400 });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Menu update error:", error);
    return NextResponse.json({ error: "Failed to update menu item." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    await requireRole(req, ["admin"]);
    const itemId = req.nextUrl.searchParams.get("itemId");
    if (!isValidItemId(itemId)) {
      return NextResponse.json({ error: "Invalid item id." }, { status: 400 });
    }
    await adminDb.collection("menuItems").doc(itemId).delete();
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Menu delete error:", error);
    return NextResponse.json({ error: "Failed to remove menu item." }, { status: 500 });
  }
}
