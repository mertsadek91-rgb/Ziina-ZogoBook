import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { listInvoices, stripeConfigured } from "@/lib/stripe";
import { jsonError } from "@/lib/api";

const STATUSES = new Set(["draft", "open", "paid", "uncollectible", "void"]);

/** Stripe invoices, read live from Stripe (newest first), with the matching local payment if any. */
export async function GET(req: Request) {
  try {
    if (!stripeConfigured()) throw new Error("لم يتم ضبط مفتاح Stripe (STRIPE_SECRET_KEY)");
    const sp = new URL(req.url).searchParams;
    const status = sp.get("status") ?? undefined;
    const r = await listInvoices({
      startingAfter: sp.get("starting_after") ?? undefined,
      status: status && STATUSES.has(status) ? status : undefined,
      limit: 50,
    });
    const ids = r.data.map((i) => i.id);
    const charges = r.data.map((i) => i.charge).filter(Boolean) as string[];
    const local = await prisma.payment.findMany({
      where: { OR: [{ stripeInvoiceId: { in: ids } }, { ziinaIntentId: { in: charges } }] },
      select: { id: true, stripeInvoiceId: true, ziinaIntentId: true, zohoInvoiceNumber: true, partnerAccountId: true },
    });
    const invoices = r.data.map((i) => {
      const p = local.find((x) => x.stripeInvoiceId === i.id || (i.charge && x.ziinaIntentId === i.charge));
      return {
        id: i.id,
        number: i.number,
        status: i.status,
        currency: i.currency.toUpperCase(),
        total: i.total,
        amountPaid: i.amount_paid,
        amountRemaining: i.amount_remaining,
        created: i.created * 1000,
        dueDate: i.due_date ? i.due_date * 1000 : null,
        customerName: i.customer_name,
        customerEmail: i.customer_email,
        hostedUrl: i.hosted_invoice_url,
        pdf: i.invoice_pdf,
        description: i.description,
        livemode: i.livemode,
        paymentId: p?.id ?? null,
        zohoInvoiceNumber: p?.zohoInvoiceNumber ?? null,
      };
    });
    return NextResponse.json({ invoices, hasMore: r.has_more, nextCursor: r.data.at(-1)?.id ?? null });
  } catch (err) {
    return jsonError(err, 502);
  }
}
