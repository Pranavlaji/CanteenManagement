import { revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { AuthError, timingSafeEqualText } from "@/lib/verify-auth";

function isAuthorized(request: NextRequest, expectedSecret: string) {
  const authorization = request.headers.get("authorization");
  const bearerPrefix = "Bearer ";
  if (authorization?.startsWith(bearerPrefix)) {
    return timingSafeEqualText(authorization.slice(bearerPrefix.length), expectedSecret);
  }

  const internalSecret = request.headers.get("x-revalidate-secret");
  return Boolean(internalSecret && timingSafeEqualText(internalSecret, expectedSecret));
}

export async function POST(request: NextRequest) {
  try {
    if (request.nextUrl.searchParams.has("secret")) {
      throw new AuthError("Query-string secrets are not accepted.", 400);
    }

    const secret = process.env.REVALIDATE_SECRET;
    if (!secret || secret.length < 16) {
      console.error("REVALIDATE_SECRET is missing or too short.");
      return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
    }

    if (!isAuthorized(request, secret)) {
      throw new AuthError("Unauthorized", 401);
    }

    revalidatePath("/");
    return NextResponse.json({ revalidated: true, now: new Date().toISOString() });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Revalidate error:", error);
    return NextResponse.json({ error: "Failed to revalidate." }, { status: 500 });
  }
}
