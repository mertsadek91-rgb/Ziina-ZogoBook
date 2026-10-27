import { prisma } from "./db";
import { FINAL_STATUSES, getPaymentIntent, intentToPaymentFields, type ZiinaStatus } from "./ziina";
import { WOO_PAID, listZiinaOrders, type WooOrder } from "./woo";

export type WooSyncResult =
  | "new" // paid order missing from the system → added
  | "updated" // in the system, but its Ziina status changed
  | "unchanged"
  | "unpaid" // order never paid in Ziina (abandoned checkout) → not added
  | "error";

export interface WooSyncLine {
  orderNumber: string;
  orderId: number;
  intentId: string;
  customer: string | null;
  total: string;
  currency: string;
  wooStatus: string;
  oldStatus: string | null; // Ziina status in the system before the sync
  newStatus: string | null; // Ziina status now
  result: WooSyncResult;
  /** Site and Ziina disagree (e.g. paid in Ziina but the order is still pending on the site). */
  mismatch: "paid_not_in_site" | "site_paid_not_in_ziina" | null;
  paymentId: string | null;
  error?: string;
}

export interface WooSyncReport {
  orders: number;
  counts: Record<WooSyncResult, number>;
  mismatches: number;
  lines: WooSyncLine[];
}

/** Compare the site's order status with the Ziina status. */
export function wooMismatch(wooStatus: string, ziina: string | null): WooSyncLine["mismatch"] {
  if (!ziina) return null;
  const sitePaid = WOO_PAID.has(wooStatus);
  if (ziina === "completed" && !sitePaid) return "paid_not_in_site";
  if (sitePaid && ziina !== "completed") return "site_paid_not_in_ziina";
  return null;
}

function customerOf(o: WooOrder) {
  const b = o.billing ?? {};
  const name = [b.first_name, b.last_name].filter(Boolean).join(" ").trim();
  return { name: name || null, email: b.email?.trim() || null, phone: b.phone?.trim() || null };
}

/**
 * Pull the site's Ziina orders (WooCommerce), check each payment intent with Ziina and add the paid
 * ones that are missing. Ziina has no "list payments" API, so the site's orders are the index.
 */
export async function syncWooOrders(sinceDays?: number): Promise<WooSyncReport> {
  const after = sinceDays ? new Date(Date.now() - sinceDays * 86400_000) : undefined;
  const orders = await listZiinaOrders(after);
  const existing = await prisma.payment.findMany({
    where: { ziinaIntentId: { in: orders.map((o) => o.transaction_id) } },
  });
  const byIntent = new Map(existing.map((p) => [p.ziinaIntentId, p]));

  const counts: Record<WooSyncResult, number> = { new: 0, updated: 0, unchanged: 0, unpaid: 0, error: 0 };
  const lines: WooSyncLine[] = [];

  for (const o of orders) {
    const c = customerOf(o);
    const p = byIntent.get(o.transaction_id);
    const line: WooSyncLine = {
      orderNumber: o.number,
      orderId: o.id,
      intentId: o.transaction_id,
      customer: c.name ?? c.email,
      total: o.total,
      currency: o.currency,
      wooStatus: o.status,
      oldStatus: p?.status ?? null,
      newStatus: p?.status ?? null,
      result: "unchanged",
      mismatch: null,
      paymentId: p?.id ?? null,
    };
    try {
      // Final Ziina states never change: no need to ask Ziina again.
      if (p && FINAL_STATUSES.includes(p.status as ZiinaStatus)) {
        if (!p.orderNumber || !p.customerName || !p.customerEmail) {
          await prisma.payment.update({
            where: { id: p.id },
            data: {
              orderNumber: p.orderNumber || o.number,
              customerName: p.customerName || c.name,
              customerEmail: p.customerEmail || c.email,
              customerPhone: p.customerPhone || c.phone,
            },
          });
        }
      } else {
        const pi = await getPaymentIntent(o.transaction_id);
        const { createdAtZiina, ...fields } = intentToPaymentFields(pi);
        line.newStatus = pi.status;
        const paidAt = pi.status === "completed" ? (o.date_paid_gmt ? new Date(`${o.date_paid_gmt}Z`) : new Date()) : null;
        if (p) {
          await prisma.payment.update({
            where: { id: p.id },
            data: {
              ...fields,
              paidAt: p.paidAt ?? paidAt,
              orderNumber: p.orderNumber || o.number,
              customerName: p.customerName || c.name,
              customerEmail: p.customerEmail || c.email,
              customerPhone: p.customerPhone || c.phone,
            },
          });
          line.result = pi.status !== p.status ? "updated" : "unchanged";
        } else if (pi.status === "completed") {
          const created = await prisma.payment.create({
            data: {
              ziinaIntentId: pi.id,
              ...fields,
              createdAt: createdAtZiina ?? undefined,
              paidAt,
              source: "woo",
              orderNumber: o.number,
              customerName: c.name,
              customerEmail: c.email,
              customerPhone: c.phone,
            },
          });
          line.paymentId = created.id;
          line.result = "new";
        } else {
          line.result = "unpaid";
        }
      }
      line.mismatch = wooMismatch(o.status, line.newStatus);
    } catch (e) {
      line.result = "error";
      line.error = e instanceof Error ? e.message : String(e);
    }
    counts[line.result]++;
    lines.push(line);
  }

  // Newest first, problems on top.
  const rank = (l: WooSyncLine) => (l.result === "error" ? 0 : l.mismatch ? 1 : l.result === "new" || l.result === "updated" ? 2 : 3);
  lines.reverse().sort((a, b) => rank(a) - rank(b));
  return { orders: orders.length, counts, mismatches: lines.filter((l) => l.mismatch).length, lines };
}
