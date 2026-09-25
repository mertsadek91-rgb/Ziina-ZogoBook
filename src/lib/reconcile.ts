import type { Payment } from "@prisma/client";
import { prisma } from "./db";
import * as zoho from "./zoho";
import { buildIndex, matchPayment, type Candidate, type ZInvoice, type ZPayment } from "./reconcile-match";

export function dubaiDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);
}

function shift(date: string, days: number): string {
  return new Date(Date.parse(date + "T00:00:00Z") + days * 86400_000).toISOString().slice(0, 10);
}

async function log(paymentId: string, step: string, success: boolean, detail: string) {
  await prisma.syncLog.create({ data: { paymentId, step, success, detail } });
}

export interface ReconcileSummary {
  checked: number;
  linked: number; // linked to Zoho (invoice and/or payment)
  newlyLinked: number;
  withCandidates: number;
  missing: number; // was linked, removed from Zoho
  unmatched: number;
}

function linkedState(invoice?: Pick<ZInvoice, "balance">, payment?: unknown) {
  return payment || (invoice && invoice.balance === 0) ? "paid" : invoice ? "invoiced" : "not_synced";
}

/**
 * Checks completed payments against Zoho Books: exact match by reference_number (Ziina intent id),
 * previously linked ids, and otherwise suggests possible matches by amount/date/customer.
 * Uses bulk date-range listing so it costs a few API calls regardless of how many payments.
 */
export async function reconcile(opts: { ids?: string[]; sinceDays?: number } = {}): Promise<ReconcileSummary> {
  const summary: ReconcileSummary = { checked: 0, linked: 0, newlyLinked: 0, withCandidates: 0, missing: 0, unmatched: 0 };

  const payments = await prisma.payment.findMany({
    where: opts.ids
      ? { id: { in: opts.ids }, status: "completed" }
      : { status: "completed", createdAt: { gte: new Date(Date.now() - (opts.sinceDays ?? 90) * 86400_000) } },
  });
  if (!payments.length) return summary;

  const dates = payments.map((p) => dubaiDate(p.paidAt ?? p.createdAt)).sort();
  const from = shift(dates[0], -7);
  const to = shift(dates[dates.length - 1], 7);
  const [invoices, zpayments] = await Promise.all([
    zoho.listInvoicesInRange(from, to),
    zoho.listPaymentsInRange(from, to),
  ]);
  const idx = buildIndex(invoices, zpayments);

  // Zoho ids already linked to local payments, so one Zoho record is never suggested twice.
  const linkedRows = await prisma.payment.findMany({
    where: { OR: [{ zohoInvoiceId: { not: null } }, { zohoPaymentId: { not: null } }] },
    select: { id: true, zohoInvoiceId: true, zohoPaymentId: true },
  });

  for (const p of payments) {
    summary.checked++;
    const usedIds = new Set(
      linkedRows.filter((r) => r.id !== p.id).flatMap((r) => [r.zohoInvoiceId, r.zohoPaymentId].filter(Boolean) as string[]),
    );
    const ignoredIds = new Set(p.zohoIgnoredIds.split(",").filter(Boolean));
    const result = matchPayment(
      {
        ziinaIntentId: p.ziinaIntentId,
        grossFils: p.amountFils + p.tipFils,
        feeFils: p.feeFils,
        date: dubaiDate(p.paidAt ?? p.createdAt),
        customerName: p.customerName,
        customerEmail: p.customerEmail,
        zohoInvoiceId: p.zohoInvoiceId,
        zohoPaymentId: p.zohoPaymentId,
      },
      idx,
      { usedIds, ignoredIds },
    );

    const now = new Date();
    if (result.kind === "linked") {
      await applyLink(p, result.invoice, result.payment, result.via === "reference" ? "مطابقة برقم المرجع" : null);
      summary.linked++;
      if (!p.zohoInvoiceId && !p.zohoPaymentId) summary.newlyLinked++;
    } else if (result.kind === "missing") {
      // The records may simply be outside the fetched date range — confirm directly before reverting.
      const invoice = result.lostInvoice ? await zoho.getInvoice(p.zohoInvoiceId!).catch(notFoundToNull) : undefined;
      const payment = result.lostPayment ? await zoho.getCustomerPayment(p.zohoPaymentId!).catch(notFoundToNull) : undefined;
      const invoiceGone = result.lostInvoice && !invoice;
      const paymentGone = result.lostPayment && !payment;
      if (!invoiceGone && !paymentGone) {
        summary.linked++;
        await prisma.payment.update({ where: { id: p.id }, data: { zohoCheckedAt: now } });
        continue;
      }
      summary.missing++;
      const keepInvoice = !!p.zohoInvoiceId && !invoiceGone;
      const what = [invoiceGone && "الفاتورة", paymentGone && "الدفعة"].filter(Boolean).join(" و");
      await prisma.payment.update({
        where: { id: p.id },
        data: {
          zohoInvoiceId: invoiceGone ? null : p.zohoInvoiceId,
          zohoInvoiceNumber: invoiceGone ? null : p.zohoInvoiceNumber,
          zohoPaymentId: paymentGone ? null : p.zohoPaymentId,
          zohoStatus: keepInvoice ? "invoiced" : p.zohoContactId ? "contact_ready" : "not_synced",
          lastError: `⚠ تم حذف ${what} من Zoho — يجب إعادة الترحيل`,
          zohoCheckedAt: now,
        },
      });
      await log(p.id, "reconcile", false, `${what} لم تعد موجودة في Zoho`);
    } else if (result.kind === "candidates") {
      summary.withCandidates++;
      const json = JSON.stringify(result.candidates);
      if (json !== p.zohoCandidates) {
        await log(p.id, "reconcile", true, `وُجدت ${result.candidates.length} مطابقة محتملة في Zoho — بحاجة لمراجعة`);
      }
      await prisma.payment.update({
        where: { id: p.id },
        data: { zohoCandidates: json, zohoCandidateCount: result.candidates.length, zohoCheckedAt: now },
      });
    } else {
      summary.unmatched++;
      await prisma.payment.update({
        where: { id: p.id },
        data: { zohoCandidates: null, zohoCandidateCount: 0, zohoCheckedAt: now },
      });
    }
  }
  return summary;
}

function notFoundToNull(e: unknown): null {
  if (zoho.isNotFound(e)) return null;
  throw e;
}

async function applyLink(
  p: Payment,
  invoice: Pick<ZInvoice, "invoice_id" | "invoice_number" | "balance" | "customer_id"> | undefined,
  payment: Pick<ZPayment, "payment_id" | "customer_id"> | undefined,
  logMessage: string | null,
) {
  const zohoStatus = linkedState(invoice, payment);
  const changed =
    p.zohoInvoiceId !== (invoice?.invoice_id ?? null) ||
    p.zohoPaymentId !== (payment?.payment_id ?? null) ||
    p.zohoStatus !== zohoStatus;
  await prisma.payment.update({
    where: { id: p.id },
    data: {
      zohoInvoiceId: invoice?.invoice_id ?? null,
      zohoInvoiceNumber: invoice?.invoice_number ?? null,
      zohoPaymentId: payment?.payment_id ?? null,
      zohoContactId: invoice?.customer_id ?? payment?.customer_id ?? p.zohoContactId,
      zohoStatus,
      zohoCandidates: null,
      zohoCandidateCount: 0,
      lastError: null,
      syncedAt: zohoStatus === "paid" ? (p.syncedAt ?? new Date()) : p.syncedAt,
      zohoCheckedAt: new Date(),
    },
  });
  if (changed && logMessage) {
    await log(
      p.id,
      "reconcile",
      true,
      `${logMessage}: ${invoice ? `فاتورة ${invoice.invoice_number}` : "بدون فاتورة"}${payment ? " + دفعة مسجلة" : " — بدون دفعة"}`,
    );
  }
}

/** User confirms a suggested match: link the local payment to that Zoho payment or invoice. */
export async function linkCandidate(
  paymentId: string,
  target: { zohoPaymentId?: string; zohoInvoiceId?: string },
): Promise<Payment> {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const ids = [target.zohoPaymentId, target.zohoInvoiceId].filter(Boolean) as string[];
  if (!ids.length) throw new Error("لم يتم تحديد سجل Zoho");
  const taken = await prisma.payment.findFirst({
    where: { id: { not: p.id }, OR: [{ zohoPaymentId: { in: ids } }, { zohoInvoiceId: { in: ids } }] },
  });
  if (taken) throw new Error("سجل Zoho هذا مرتبط بدفعة Ziina أخرى");

  let invoice: Pick<ZInvoice, "invoice_id" | "invoice_number" | "balance" | "customer_id"> | undefined;
  let payment: Pick<ZPayment, "payment_id" | "customer_id"> | undefined;
  if (target.zohoPaymentId) {
    const zp = await zoho.getCustomerPayment(target.zohoPaymentId);
    payment = zp;
    const applied = zp.invoices?.[0];
    if (applied) {
      const inv = await zoho.getInvoice(applied.invoice_id);
      invoice = { invoice_id: inv.invoice_id, invoice_number: inv.invoice_number, balance: inv.balance, customer_id: inv.customer_id };
    }
  } else if (target.zohoInvoiceId) {
    const inv = await zoho.getInvoice(target.zohoInvoiceId);
    invoice = { invoice_id: inv.invoice_id, invoice_number: inv.invoice_number, balance: inv.balance, customer_id: inv.customer_id };
  }
  await applyLink(p, invoice, payment, "ربط يدوي مؤكد");
  return prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
}

/** User rejects suggested matches (all, or specific Zoho ids). */
export async function ignoreCandidates(paymentId: string, zohoIds?: string[]): Promise<Payment> {
  const p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  const candidates: Candidate[] = p.zohoCandidates ? JSON.parse(p.zohoCandidates) : [];
  const reject = zohoIds?.length
    ? zohoIds
    : candidates.flatMap((c) => [c.paymentId, c.invoiceId].filter(Boolean) as string[]);
  const ignored = new Set([...p.zohoIgnoredIds.split(",").filter(Boolean), ...reject]);
  const remaining = candidates.filter((c) => !reject.includes(c.paymentId ?? "") && !reject.includes(c.invoiceId ?? ""));
  await log(p.id, "reconcile", true, "تم تأكيد أن المطابقات المقترحة ليست لهذه الدفعة");
  return prisma.payment.update({
    where: { id: p.id },
    data: {
      zohoIgnoredIds: [...ignored].join(","),
      zohoCandidates: remaining.length ? JSON.stringify(remaining) : null,
      zohoCandidateCount: remaining.length,
    },
  });
}
