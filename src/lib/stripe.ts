// Minimal read-only Stripe REST client (no SDK). Use a *restricted* key with read access to:
// Balance, Balance transactions, Charges, Customers, Invoices.

import type { StripeBalanceTransaction, StripeCharge } from "./stripe-map";

const BASE = "https://api.stripe.com/v1";

export class StripeError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/** "live" or "test", from the key prefix (sk_live_ / rk_live_ vs sk_test_ / rk_test_). */
export function stripeKeyMode(): "live" | "test" {
  return /^(sk|rk)_test_/.test(process.env.STRIPE_SECRET_KEY ?? "") ? "test" : "live";
}

/** Settings key holding the sync cursor. One per mode, so switching test → live imports the full live history. */
export function stripeCursorKey(): string {
  // "_v2": bumped when a new field is filled from Stripe (order number) → one full, idempotent re-sync.
  return `stripe_synced_until_${stripeKeyMode()}_v2`;
}

type Query = Record<string, string | number | undefined | string[]>;

async function get<T>(path: string, query: Query = {}): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("STRIPE_SECRET_KEY غير مضبوط");
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) v.forEach((x) => qs.append(k, x));
    else qs.set(k, String(v));
  }
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${BASE}${path}?${qs}`, {
      headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2024-06-20" },
      cache: "no-store",
    });
    if (res.status === 429 && attempt < 4) {
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      continue;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    if (!res.ok) throw new StripeError(`Stripe: ${data.error?.message ?? res.status}`, res.status, data);
    return data as T;
  }
}

interface List<T> {
  data: T[];
  has_more: boolean;
}

/** Read access check + account currency (the balance lists amounts per currency). */
export async function stripeBalance() {
  return get<{ livemode: boolean; available: { amount: number; currency: string }[]; pending: { amount: number; currency: string }[] }>(
    "/balance",
  );
}

/** All balance transactions created at/after `since` (unix seconds), oldest first, charges expanded. */
export async function listBalanceTransactions(since?: number): Promise<StripeBalanceTransaction[]> {
  const all: StripeBalanceTransaction[] = [];
  let startingAfter: string | undefined;
  for (let page = 0; page < 500; page++) {
    const r = await get<List<StripeBalanceTransaction>>("/balance_transactions", {
      limit: 100,
      "created[gte]": since,
      starting_after: startingAfter,
      "expand[]": ["data.source", "data.source.customer", "data.source.invoice"],
    });
    all.push(...r.data);
    if (!r.has_more || !r.data.length) break;
    startingAfter = r.data[r.data.length - 1].id;
  }
  return all.reverse(); // Stripe returns newest first
}

export function getCharge(id: string): Promise<StripeCharge> {
  return get<StripeCharge>(`/charges/${encodeURIComponent(id)}`, { "expand[]": ["customer", "invoice"] });
}

export interface StripeInvoice {
  id: string;
  number: string | null;
  status: string | null; // draft | open | paid | uncollectible | void
  currency: string;
  amount_due: number;
  amount_paid: number;
  amount_remaining: number;
  total: number;
  created: number;
  due_date: number | null;
  customer_name: string | null;
  customer_email: string | null;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  charge: string | null;
  description: string | null;
  livemode: boolean;
}

export async function listInvoices(opts: { startingAfter?: string; status?: string; limit?: number }) {
  return get<List<StripeInvoice>>("/invoices", {
    limit: opts.limit ?? 50,
    starting_after: opts.startingAfter,
    status: opts.status,
  });
}
