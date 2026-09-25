import { NextResponse } from "next/server";
import { syncStripe } from "@/lib/stripe-sync";
import { stripeConfigured } from "@/lib/stripe";
import { jsonError } from "@/lib/api";

/** Pull new Stripe payments and refunds now (the cron job does the same every 10 minutes). */
export async function POST() {
  try {
    if (!stripeConfigured()) throw new Error("لم يتم ضبط مفتاح Stripe (STRIPE_SECRET_KEY)");
    return NextResponse.json({ summary: await syncStripe() });
  } catch (err) {
    return jsonError(err, 502);
  }
}
