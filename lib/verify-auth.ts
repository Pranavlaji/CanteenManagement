import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
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

// Initialize Firebase Admin SDK (singleton)
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

/**
 * Verifies a Firebase ID token from the Authorization header.
 * Returns the decoded user identity or throws.
 */
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
    const role = (decoded.role as VerifiedUser["role"]) || "student";
    return {
      uid: decoded.uid,
      email: decoded.email || "",
      role,
    };
  } catch {
    throw new AuthError("Invalid or expired ID token.", 401);
  }
}

/**
 * Simple in-memory rate limiter. Per-user, sliding window.
 * Resets on deploy — acceptable for college canteen scale.
 */
const rateLimits = new Map<string, { count: number; resetAt: number }>();

export function assertRateLimit(uid: string, key: string, maxPerMinute = 6) {
  const id = `${uid}_${key}`;
  const now = Date.now();
  const entry = rateLimits.get(id);

  if (entry && now < entry.resetAt) {
    if (entry.count >= maxPerMinute) {
      throw new AuthError("Too many requests. Try again shortly.", 429);
    }
    entry.count++;
  } else {
    rateLimits.set(id, { count: 1, resetAt: now + 60_000 });
  }
}

/** Custom error with HTTP status code */
export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthError";
    this.status = status;
  }
}
