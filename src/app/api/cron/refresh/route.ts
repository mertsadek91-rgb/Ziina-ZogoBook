import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { refreshFromZiina } from "@/lib/sync";
import { reconcile } from "@/lib/reconcile";
import { syncStripe } from "@/lib/stripe-sync";

/**
 * Safety net for missed webhooks: re-fetch non-final intents from the last 30 days.
 * Call every ~10 minutes with header `Authorization: Bearer <CRON_SECRET>`.
 */
async function handler(req: Request) {
  const secret = env.cronSecret();
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pending = await prisma.payment.findMany({
    where: {
      source: { not: "csv" },
      gateway: "ziina",
      archived: false,
      status: { in: ["requires_payment_instrument", "requires_user_action", "pending"] },
      createdAt: { gte: new Date(Date.now() - 30 * 86400_000) },
    },
    take: 100,
  });
  let updated = 0;
  const errors: string[] = [];
  for (const p of pending) {
    try {
      const r = await refreshFromZiina(p);
      if (r.status !== p.status) updated++;
    } catch (e) {
      errors.push(`${p.ziinaIntentId}: ${e instanceof Error ? e.message : e}`);
    }
  }
  // Pull new Stripe payments / refunds (read-only), when a key is configured.
  let stripe: unknown = null;
  try {
    stripe = await syncStripe();
  } catch (e) {
    errors.push(`stripe: ${e instanceof Error ? e.message : e}`);
  }

  // Then check completed payments against Zoho (catches invoices/payments added or deleted there manually).
  let zoho: unknown = null;
  try {
    zoho = await reconcile({ sinceDays: 60 });
  } catch (e) {
    errors.push(`zoho reconcile: ${e instanceof Error ? e.message : e}`);
  }
  return NextResponse.json({ checked: pending.length, updated, stripe, zoho, errors });
}

export { handler as GET, handler as POST };
