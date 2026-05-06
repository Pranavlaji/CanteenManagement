import crypto from "crypto";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { NextRequest } from "next/server";

function privateKeyFromEnv() {
  const key = process.env.FIREBASE_PRIVATE_KEY;
  if (!key) return "";
  return key.replace(/\\n/g, "\n");
}

function serviceAccountCredential() {
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountJson) {
    return cert(JSON.parse(serviceAccountJson));
  }

  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = privateKeyFromEnv();

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return cert({
    projectId,
    clientEmail,
    privateKey,
  });
}

if (!getApps().length) {
  const credential = serviceAccountCredential();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  initializeApp({
    ...(credential ? { credential } : {}),
    ...(projectId ? { projectId } : {}),
  });
}

export const adminAuth = getAuth();
export const adminDb = getFirestore();

export type VerifiedUser = {
  uid: string;
  email: string;
  role: "student" | "staff" | "admin";
};

function parseRole(value: unknown): VerifiedUser["role"] | null {
  return value === "admin" || value === "staff" || value === "student" ? value : null;
}

export async function verifyRequest(req: NextRequest): Promise<VerifiedUser> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthError("Missing or malformed Authorization header.", 401);
  }

  const idToken = authHeader.slice(7);
  if (!idToken) {
    throw new AuthError("Empty ID token.", 401);
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const email = decoded.email || "";
    const role = parseRole(decoded.role) || "student";
    return {
      uid: decoded.uid,
      email,
      role,
    };
  } catch {
    throw new AuthError("Invalid or expired ID token.", 401);
  }
}

export async function requireRole(
  req: NextRequest,
  allowedRoles: Array<Exclude<VerifiedUser["role"], "student">>
) {
  const user = await verifyRequest(req);
  if (!allowedRoles.includes(user.role as Exclude<VerifiedUser["role"], "student">)) {
    throw new AuthError("Insufficient role.", 403);
  }
  return user;
}

export async function assertRateLimit(uid: string, key: string, maxPerMinute = 6) {
  if (!uid || !/^[a-zA-Z0-9_-]{1,64}$/.test(key)) {
    throw new AuthError("Invalid rate limit input.", 400);
  }

  const id = crypto.createHash("sha256").update(`${uid}:${key}`).digest("hex");
  const now = Date.now();
  const ref = adminDb.collection("rateLimits").doc(id);

  await adminDb.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const currentResetAt = Number(snap.get("resetAt") || 0);
    const currentCount = Number(snap.get("count") || 0);

    if (snap.exists && now < currentResetAt) {
      if (currentCount >= maxPerMinute) {
        throw new AuthError("Too many requests. Try again shortly.", 429);
      }

      tx.update(ref, {
        count: currentCount + 1,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return;
    }

    tx.set(ref, {
      uid,
      key,
      count: 1,
      resetAt: now + 60_000,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

export function getRazorpayCredentials() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    console.error("Razorpay credentials are not configured.");
    throw new AuthError("Payment configuration error.", 500);
  }

  return {
    key_id: keyId,
    key_secret: keySecret,
  };
}

export function isValidHexSignature(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

export function timingSafeEqualText(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
