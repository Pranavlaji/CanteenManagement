import { NextRequest, NextResponse } from "next/server";
import Razorpay from "razorpay";

export async function POST(req: NextRequest) {
  try {
    console.log("Loading Razorpay Keys:", {
      id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ? "PRESENT" : "MISSING",
      secret: process.env.RAZORPAY_KEY_SECRET ? "PRESENT" : "MISSING"
    });

    const razorpay = new Razorpay({
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
      key_secret: process.env.RAZORPAY_KEY_SECRET || "",
    });

    const body = await req.json();
    const { amount, receipt } = body;

    if (!amount || amount < 100) {
      return NextResponse.json(
        { error: "Invalid amount. Minimum amount is 1 INR (100 paise)." },
        { status: 400 }
      );
    }

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      receipt: receipt || `rcpt_${Date.now()}`,
    });

    return NextResponse.json(order, { status: 200 });
  } catch (error: any) {
    console.error("Razorpay Create Order Error:", error);
    return NextResponse.json(
      { error: error?.error?.description || error.message || "Failed to create Razorpay order." },
      { status: 500 }
    );
  }
}
