import { prisma } from "./db";
import { fromMinor, toMinor } from "./money";

interface Amounts {
  amountFils: number; // settled (AED)
  tipFils: number;
  originalAmountFils: number | null; // what the customer paid, in their currency
  originalCurrency: string | null;
}

/**
 * Convert a refund to the settlement currency (AED fils). A refund in the customer's currency
 * (e.g. USD 45 of USD 50) is converted at the rate of the original payment.
 */
export function refundToSettledFils(p: Amounts, amount: number | string, currency: string): number {
  const gross = p.amountFils + p.tipFils;
  if (currency === "AED") return toMinor(amount, "AED");
  if (!p.originalAmountFils || p.originalCurrency !== currency) {
    throw new Error(`لا يمكن تحويل ${currency} — أدخل المبلغ المسترد بالدرهم`);
  }
  return Math.round((gross * toMinor(amount, currency)) / p.originalAmountFils);
}

/** Set the total refunded part of a payment (AED fils), with an audit log line. */
export async function setRefunded(paymentId: string, refundedFils: number, detail: string) {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const gross = p.amountFils + p.tipFils;
  if (refundedFils < 0 || refundedFils > gross) throw new Error("المبلغ المسترد أكبر من مبلغ الدفعة");
  const updated = await prisma.payment.update({ where: { id: p.id }, data: { amountRefundedFils: refundedFils } });
  await prisma.syncLog.create({ data: { paymentId: p.id, step: "refund", success: true, detail } });
  return updated;
}

/** Ziina refund webhook: add a completed refund once (keyed by refund id). */
export async function applyZiinaRefund(r: { id: string; payment_intent_id: string; amount: number; currency_code: string; status: string }) {
  if (r.status !== "completed") return { ignored: "not completed" };
  const p = await prisma.payment.findUnique({ where: { ziinaIntentId: r.payment_intent_id } });
  if (!p) return { ignored: "unknown payment" };
  const seen = await prisma.syncLog.findFirst({ where: { paymentId: p.id, step: "refund", detail: { contains: r.id } } });
  if (seen) return { ignored: "already applied" };
  const fils = refundToSettledFils(p, fromMinor(r.amount, r.currency_code), r.currency_code);
  const total = Math.min(p.amountFils + p.tipFils, p.amountRefundedFils + fils);
  await setRefunded(p.id, total, `استرداد من Ziina ${r.id}: ${fromMinor(r.amount, r.currency_code)} ${r.currency_code}`);
  return { applied: fils };
}

