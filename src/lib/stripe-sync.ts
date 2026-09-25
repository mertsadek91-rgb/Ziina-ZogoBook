import { prisma, getSetting, setSetting } from "./db";
import { getCharge, listBalanceTransactions, stripeConfigured } from "./stripe";
import {
  FILL_IF_EMPTY,
  REFUND_TYPES,
  SALE_TYPES,
  STRIPE_OWNED,
  chargeStatus,
  isCharge,
  mapStripeSale,
  refundedInSettlement,
  type StripeSaleFields,
} from "./stripe-map";

const CURSOR_KEY = "stripe_synced_until";
const OVERLAP_S = 2 * 86400; // re-read the last two days: upserts make it idempotent

export interface StripeSyncSummary {
  fetched: number;
  created: number;
  updated: number;
  refundsUpdated: number;
}

async function upsertSale(fields: StripeSaleFields): Promise<"created" | "updated"> {
  const existing = await prisma.payment.findUnique({ where: { ziinaIntentId: fields.ziinaIntentId } });
  if (!existing) {
    await prisma.payment.create({ data: fields });
    return "created";
  }
  const data: Record<string, unknown> = {};
  for (const k of STRIPE_OWNED) data[k] = fields[k];
  for (const k of FILL_IF_EMPTY) if (!existing[k as keyof typeof existing] && fields[k]) data[k] = fields[k];
  await prisma.payment.update({ where: { id: existing.id }, data });
  return "updated";
}

/**
 * Pull Stripe balance transactions since the last sync (the whole history the first time) and
 * upsert them as payments with gateway "stripe". Read-only towards Stripe.
 */
export async function syncStripe(): Promise<StripeSyncSummary> {
  const summary: StripeSyncSummary = { fetched: 0, created: 0, updated: 0, refundsUpdated: 0 };
  if (!stripeConfigured()) return summary;

  const cursor = await getSetting(CURSOR_KEY);
  const since = cursor ? Math.max(0, Number(cursor) - OVERLAP_S) : undefined;
  const txns = await listBalanceTransactions(since);
  summary.fetched = txns.length;
  let maxCreated = cursor ? Number(cursor) : 0;
  const refundedCharges = new Set<string>();

  for (const bt of txns) {
    maxCreated = Math.max(maxCreated, bt.created);
    if (SALE_TYPES.has(bt.type) && isCharge(bt.source)) {
      const r = await upsertSale(mapStripeSale(bt, bt.source));
      summary[r]++;
    } else if (REFUND_TYPES.has(bt.type) && bt.source && typeof bt.source === "object") {
      const chargeId = (bt.source as { charge?: string | null }).charge;
      if (chargeId) refundedCharges.add(chargeId);
    }
  }

  // Refunds: re-read the charge so the refunded amount and status are exact (idempotent).
  for (const chargeId of refundedCharges) {
    const p = await prisma.payment.findUnique({ where: { ziinaIntentId: chargeId } });
    if (!p) continue;
    const c = await getCharge(chargeId);
    await prisma.payment.update({
      where: { id: p.id },
      data: { status: chargeStatus(c), amountRefundedFils: refundedInSettlement(p.amountFils, c) },
    });
    await prisma.syncLog.create({
      data: {
        paymentId: p.id,
        step: "stripe",
        success: true,
        detail: c.refunded ? "تم استرداد الدفعة بالكامل في Stripe" : "استرداد جزئي في Stripe",
      },
    });
    summary.refundsUpdated++;
  }

  if (maxCreated) await setSetting(CURSOR_KEY, String(maxCreated));
  return summary;
}
