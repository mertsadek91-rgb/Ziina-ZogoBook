// Maps Stripe API objects to local Payment fields. Pure — covered by unit tests.
//
// We read Stripe *balance transactions*: they carry the amount and the Stripe fee in the account's
// settlement currency (AED for a UAE account), which is what gets invoiced and booked — exactly like
// Ziina's "settled" amount. The charge (expanded as `source`) adds customer, card and invoice data.

export interface StripeInvoiceLite {
  id: string;
  number?: string | null;
  hosted_invoice_url?: string | null;
  invoice_pdf?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
}

export interface StripeCustomerLite {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
}

export interface StripeCharge {
  id: string;
  object: "charge";
  amount: number;
  amount_refunded?: number;
  currency: string;
  created: number;
  status: "succeeded" | "pending" | "failed";
  paid?: boolean;
  refunded?: boolean;
  livemode?: boolean;
  description?: string | null;
  receipt_email?: string | null;
  billing_details?: { name?: string | null; email?: string | null; phone?: string | null } | null;
  customer?: string | StripeCustomerLite | null;
  invoice?: string | StripeInvoiceLite | null;
  payment_method_details?: { card?: { brand?: string | null; last4?: string | null } | null } | null;
  metadata?: Record<string, string>;
}

export interface StripeBalanceTransaction {
  id: string;
  amount: number; // gross, settlement currency, base units (negative for refunds)
  fee: number;
  net: number;
  currency: string;
  created: number;
  type: string; // charge | payment | refund | payment_refund | payout | stripe_fee | adjustment …
  source: string | StripeCharge | { id: string; object: string; charge?: string | null } | null;
}

export const SALE_TYPES = new Set(["charge", "payment"]);
export const REFUND_TYPES = new Set(["refund", "payment_refund"]);

const clean = (v?: string | null) => (v && v.trim() ? v.trim() : null);

export function isCharge(src: StripeBalanceTransaction["source"]): src is StripeCharge {
  return !!src && typeof src === "object" && (src as { object?: string }).object === "charge";
}

/** Status mapping: a fully refunded charge is not revenue any more. */
export function chargeStatus(c: StripeCharge): string {
  if (c.refunded) return "refunded";
  if (c.status === "succeeded") return "completed";
  if (c.status === "failed") return "failed";
  return "pending";
}

/** Refunded part in the settlement currency (pro-rata when the charge was in another currency). */
export function refundedInSettlement(btAmount: number, c: StripeCharge): number {
  const refunded = c.amount_refunded ?? 0;
  if (!refunded || !c.amount) return 0;
  return refunded >= c.amount ? btAmount : Math.round((btAmount * refunded) / c.amount);
}

/** Local Payment fields for a sale balance transaction whose `source` is the expanded charge. */
export function mapStripeSale(bt: StripeBalanceTransaction, c: StripeCharge) {
  const settlementCurrency = bt.currency.toUpperCase();
  const chargeCurrency = c.currency.toUpperCase();
  const customer = typeof c.customer === "object" && c.customer ? c.customer : null;
  const invoice = typeof c.invoice === "object" && c.invoice ? c.invoice : null;
  const invoiceId = typeof c.invoice === "string" ? c.invoice : invoice?.id ?? null;
  const when = new Date(c.created * 1000);
  return {
    ziinaIntentId: c.id, // the external id column holds the Stripe charge id for Stripe payments
    gateway: "stripe",
    source: "stripe",
    status: chargeStatus(c),
    amountFils: bt.amount,
    currency: settlementCurrency,
    feeFils: bt.fee,
    tipFils: 0,
    settledFils: bt.net,
    amountRefundedFils: refundedInSettlement(bt.amount, c),
    originalAmountFils: chargeCurrency !== settlementCurrency ? c.amount : null,
    originalCurrency: chargeCurrency !== settlementCurrency ? chargeCurrency : null,
    paidAt: c.status === "succeeded" ? when : null,
    createdAt: when,
    message: clean(c.description),
    cardBrand: clean(c.payment_method_details?.card?.brand ?? null),
    cardLast4: clean(c.payment_method_details?.card?.last4 ?? null),
    test: c.livemode === false,
    customerName: clean(c.billing_details?.name) ?? clean(customer?.name) ?? clean(invoice?.customer_name),
    customerEmail:
      clean(c.billing_details?.email) ?? clean(c.receipt_email) ?? clean(customer?.email) ?? clean(invoice?.customer_email),
    customerPhone: clean(c.billing_details?.phone) ?? clean(customer?.phone),
    stripeInvoiceId: invoiceId,
    stripeInvoiceNumber: clean(invoice?.number),
    stripeInvoiceUrl: clean(invoice?.hosted_invoice_url),
    stripeInvoicePdf: clean(invoice?.invoice_pdf),
  };
}

export type StripeSaleFields = ReturnType<typeof mapStripeSale>;

/**
 * Fields that Stripe owns and that are refreshed on every sync. Customer details are only filled
 * when empty locally, so edits made in the app are kept.
 */
export const STRIPE_OWNED: (keyof StripeSaleFields)[] = [
  "status",
  "amountFils",
  "currency",
  "feeFils",
  "settledFils",
  "amountRefundedFils",
  "originalAmountFils",
  "originalCurrency",
  "paidAt",
  "cardBrand",
  "cardLast4",
  "test",
  "stripeInvoiceId",
  "stripeInvoiceNumber",
  "stripeInvoiceUrl",
  "stripeInvoicePdf",
];

export const FILL_IF_EMPTY: (keyof StripeSaleFields)[] = ["customerName", "customerEmail", "customerPhone", "message"];
