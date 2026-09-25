import { beforeEach, describe, expect, it, vi } from "vitest";
import { chargeStatus, mapStripeSale, orderFromCheckout, refundedInSettlement, stripeOrderNumber, type StripeBalanceTransaction, type StripeCharge } from "@/lib/stripe-map";
import { suggestBooking } from "@/lib/bank-csv";
import { accountBalance, periodReport, type AccountLite, type SaleLite } from "@/lib/ledger-calc";

const charge = (o: Partial<StripeCharge> = {}): StripeCharge => ({
  id: "ch_1",
  object: "charge",
  amount: 10000,
  amount_refunded: 0,
  currency: "aed",
  created: 1790300000,
  status: "succeeded",
  refunded: false,
  livemode: true,
  description: "Consulting",
  billing_details: { name: "Sara Khan", email: "sara@x.com", phone: null },
  customer: { id: "cus_1", name: "Sara K.", email: "other@x.com", phone: "+971500000000" },
  invoice: { id: "in_1", number: "ABC-0001", hosted_invoice_url: "https://invoice.stripe.com/i/1", invoice_pdf: "https://pay.stripe.com/pdf/1" },
  payment_method_details: { card: { brand: "visa", last4: "4242" } },
  ...o,
});
const bt = (o: Partial<StripeBalanceTransaction> = {}): StripeBalanceTransaction => ({
  id: "txn_1",
  amount: 10000,
  fee: 390,
  net: 9610,
  currency: "aed",
  created: 1790300100,
  type: "charge",
  source: null,
  ...o,
});

describe("mapStripeSale", () => {
  it("uses the settlement amount and Stripe fee, and customer/card/invoice data from the charge", () => {
    const f = mapStripeSale(bt(), charge());
    expect(f).toMatchObject({
      ziinaIntentId: "ch_1",
      gateway: "stripe",
      source: "stripe",
      status: "completed",
      amountFils: 10000,
      currency: "AED",
      feeFils: 390,
      settledFils: 9610,
      originalAmountFils: null,
      customerName: "Sara Khan", // billing details win over the customer object
      customerEmail: "sara@x.com",
      customerPhone: "+971500000000", // falls back to the customer object
      cardBrand: "visa",
      cardLast4: "4242",
      test: false,
      stripeInvoiceId: "in_1",
      stripeInvoiceNumber: "ABC-0001",
    });
    expect(f.paidAt?.toISOString()).toBe(new Date(1790300000 * 1000).toISOString());
  });

  it("keeps the customer's currency for foreign charges while invoicing the settled AED", () => {
    const f = mapStripeSale(bt({ amount: 38500, fee: 1500, net: 37000 }), charge({ amount: 10608, currency: "usd" }));
    expect(f).toMatchObject({ amountFils: 38500, currency: "AED", originalAmountFils: 10608, originalCurrency: "USD" });
  });

  it("handles refunds, test mode and an invoice given only as an id", () => {
    expect(chargeStatus(charge({ refunded: true, amount_refunded: 10000 }))).toBe("refunded");
    expect(refundedInSettlement(38500, charge({ amount: 10608, amount_refunded: 5304 }))).toBe(19250); // half, pro rata
    expect(refundedInSettlement(38500, charge({ amount: 10608, amount_refunded: 10608 }))).toBe(38500);
    const f = mapStripeSale(bt(), charge({ livemode: false, invoice: "in_9", billing_details: null, customer: "cus_9", receipt_email: "r@x.com" }));
    expect(f).toMatchObject({ test: true, stripeInvoiceId: "in_9", stripeInvoiceNumber: null, customerEmail: "r@x.com", customerName: null });
  });
});

describe("stripeOrderNumber", () => {
  it("takes the order number from metadata, then the invoice number, then the description", () => {
    expect(stripeOrderNumber(charge({ metadata: { order_id: "#A-1009" } }))).toBe("A-1009");
    expect(stripeOrderNumber(charge({ metadata: {} }))).toBe("ABC-0001"); // invoice number
    expect(stripeOrderNumber(charge({ invoice: null, description: "Order #333140 - consulting" }))).toBe("333140");
    expect(stripeOrderNumber(charge({ invoice: null, description: "Consulting" }))).toBeNull();
  });
  it("reads the order from a Checkout session (Payment Links): metadata, client reference, then item names", () => {
    const items = (...d: string[]) => ({ data: d.map((description) => ({ description })) });
    expect(orderFromCheckout({ id: "cs_1", line_items: items("Order #21237") })).toBe("21237");
    expect(orderFromCheckout({ id: "cs_1", line_items: { data: [{ description: null, price: { product: { name: "Order #555" } } }] } })).toBe("555");
    expect(orderFromCheckout({ id: "cs_1", client_reference_id: "#REF-9", line_items: items("Order #1") })).toBe("REF-9");
    expect(orderFromCheckout({ id: "cs_1", metadata: { order_id: "M-7" }, line_items: items("Order #1") })).toBe("M-7");
    expect(orderFromCheckout({ id: "cs_1", line_items: items("Consulting session") })).toBeNull();
  });

  it("is mapped and never overwrites a number typed in the app", async () => {
    expect(mapStripeSale(bt(), charge({ metadata: { order_number: "777" } })).orderNumber).toBe("777");
  });
});

describe("Stripe in accounting", () => {
  const ACC: AccountLite[] = [
    { id: "z", key: "ziina", name: "Ziina", kind: "gateway", openingFils: 0 },
    { id: "s", key: "stripe", name: "Stripe", kind: "gateway", openingFils: 0 },
    { id: "w", key: "wio", name: "Wio", kind: "bank", openingFils: 0 },
  ];
  const SALES: SaleLite[] = [
    { date: new Date("2026-09-10T12:00:00+04:00"), grossFils: 20000, feeFils: 1000, gateway: "ziina" },
    { date: new Date("2026-09-11T12:00:00+04:00"), grossFils: 10000, feeFils: 390, gateway: "stripe" },
  ];
  const ENTRIES = [{ date: new Date("2026-09-21T12:00:00+04:00"), kind: "transfer", amountFils: 358, feeFils: 0, fromAccountId: "s", toAccountId: "w" }];

  it("credits each gateway account with its own sales and debits its payouts", () => {
    expect(accountBalance(ACC[0], ENTRIES, SALES)).toBe(19000);
    expect(accountBalance(ACC[1], ENTRIES, SALES)).toBe(9610 - 358);
    expect(accountBalance(ACC[2], ENTRIES, SALES)).toBe(358);
  });

  it("reports sales per gateway and counts Stripe payouts as gateway withdrawals", () => {
    const r = periodReport(ACC, ENTRIES, SALES);
    expect(r.salesByGateway).toEqual([
      { gateway: "stripe", count: 1, sales: 10000, fees: 390 },
      { gateway: "ziina", count: 1, sales: 20000, fees: 1000 },
    ]);
    expect(r.gatewayFees).toBe(1390);
    expect(r.gatewayWithdrawals).toBe(358);
    expect(r.withdrawalsByGateway).toEqual([
      { accountId: "z", name: "Ziina", amount: 0 },
      { accountId: "s", name: "Stripe", amount: 358 },
    ]);
  });

  it("classifies the Wio line for a Stripe payout as a transfer from Stripe", () => {
    const line = {
      date: "2026-09-21T00:00:00+04:00",
      amountFils: 358,
      description: "From NETWORK INTERNATIONAL LLC",
      notes: "STRIPE-1IT10ZHVYYQPKQJY19QOZMO3ZJIQSTRIPE",
      externalId: "bank:ref:303698544",
    };
    const ctx = { bankAccountId: "w", gatewayAccountId: "z", stripeAccountId: "s", partners: [] };
    expect(suggestBooking(line, ctx)).toEqual({ kind: "transfer", fromAccountId: "s", toAccountId: "w" });
    // Without a Stripe account it stays other income.
    expect(suggestBooking(line, { ...ctx, stripeAccountId: undefined })).toEqual({ kind: "income", toAccountId: "w" });
  });
});

// ---------- syncStripe with mocked Stripe + DB ----------

const db = { payments: new Map<string, Record<string, unknown>>(), settings: new Map<string, string>(), logs: [] as unknown[] };
const stripeApi = {
  txns: [] as StripeBalanceTransaction[],
  charges: new Map<string, StripeCharge>(),
  lastSince: undefined as number | undefined,
  mode: "live" as "live" | "test",
  sessions: new Map<string, unknown>(),
  checkoutDenied: false,
  checkoutCalls: 0,
};

vi.mock("@/lib/db", () => ({
  prisma: {
    payment: {
      findUnique: async ({ where }: { where: { ziinaIntentId: string } }) =>
        [...db.payments.values()].find((p) => p.ziinaIntentId === where.ziinaIntentId) ?? null,
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const p = { id: `p${db.payments.size + 1}`, ...data };
        db.payments.set(p.id as string, p);
        return p;
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const p = { ...db.payments.get(where.id)!, ...data };
        db.payments.set(where.id, p);
        return p;
      },
    },
    syncLog: { create: async ({ data }: { data: unknown }) => db.logs.push(data) },
  },
  getSetting: async (k: string) => db.settings.get(k) ?? null,
  setSetting: async (k: string, v: string) => void db.settings.set(k, v),
}));

vi.mock("@/lib/stripe", () => {
  class StripeError extends Error {
    constructor(message: string, public status?: number) {
      super(message);
    }
  }
  return {
  StripeError,
  findCheckoutSession: async (pi: string) => {
    stripeApi.checkoutCalls++;
    if (stripeApi.checkoutDenied) throw new StripeError("The provided key does not have the required permissions", 403);
    return stripeApi.sessions.get(pi) ?? null;
  },
  stripeConfigured: () => true,
  stripeCursorKey: () => `stripe_synced_until_${stripeApi.mode}`,
  listBalanceTransactions: async (since?: number) => {
    stripeApi.lastSince = since;
    return stripeApi.txns;
  },
  getCharge: async (id: string) => stripeApi.charges.get(id)!,
  };
});

const { syncStripe } = await import("@/lib/stripe-sync");

describe("syncStripe", () => {
  beforeEach(() => {
    db.payments.clear();
    db.settings.clear();
    db.logs = [];
    stripeApi.txns = [];
    stripeApi.charges.clear();
    stripeApi.mode = "live";
    stripeApi.sessions.clear();
    stripeApi.checkoutDenied = false;
    stripeApi.checkoutCalls = 0;
  });

  it("takes the order number from the Checkout session when the charge has none (\"Order #21237\")", async () => {
    stripeApi.sessions.set("pi_1", { id: "cs_1", line_items: { data: [{ description: "Order #21237" }] } });
    stripeApi.txns = [bt({ source: charge({ payment_intent: "pi_1", metadata: {}, description: null }) })];
    await syncStripe();
    expect([...db.payments.values()][0]).toMatchObject({ orderNumber: "21237" });
    // Next sync: the payment already has an order number → no extra Checkout lookup.
    await syncStripe();
    expect(stripeApi.checkoutCalls).toBe(1);
  });

  it("keeps syncing when the key lacks Checkout permission, falls back to the invoice number, and reports it", async () => {
    stripeApi.checkoutDenied = true;
    stripeApi.txns = [
      bt({ source: charge({ payment_intent: "pi_1" }) }),
      bt({ id: "txn_2", source: charge({ id: "ch_2", payment_intent: "pi_2" }) }),
    ];
    const s = await syncStripe();
    expect(s).toMatchObject({ created: 2, checkoutPermissionMissing: true });
    expect(stripeApi.checkoutCalls).toBe(1); // stops asking after the first 403
    expect([...db.payments.values()][0]).toMatchObject({ orderNumber: "ABC-0001" });
  });

  it("keeps a separate cursor per mode: switching a test key for a live key imports the full live history", async () => {
    stripeApi.mode = "test";
    stripeApi.txns = [bt({ source: charge({ livemode: false }) })];
    await syncStripe();
    expect(db.settings.get("stripe_synced_until_test")).toBe("1790300100");
    expect([...db.payments.values()][0]).toMatchObject({ test: true });

    stripeApi.mode = "live";
    stripeApi.txns = [];
    await syncStripe();
    expect(stripeApi.lastSince).toBeUndefined(); // no live cursor yet → whole history
  });

  it("imports all history first, then only recent days, without duplicates or overwriting local edits", async () => {
    stripeApi.txns = [bt({ source: charge() }), bt({ id: "txn_po", type: "payout", amount: -9610, source: null })];
    const s1 = await syncStripe();
    expect(stripeApi.lastSince).toBeUndefined(); // whole history on first run
    expect(s1).toMatchObject({ fetched: 2, created: 1, updated: 0 });
    expect(db.settings.get("stripe_synced_until_live")).toBe("1790300100");
    expect([...db.payments.values()][0]).toMatchObject({ orderNumber: "ABC-0001" });

    // The user fixes the customer name and assigns a partner in the app.
    const [p] = [...db.payments.values()];
    db.payments.set(p.id as string, { ...p, customerName: "Sara Khan (edited)", partnerAccountId: "m", orderNumber: "MY-1" });

    const s2 = await syncStripe();
    expect(stripeApi.lastSince).toBe(1790300100 - 2 * 86400); // 2-day overlap
    expect(s2).toMatchObject({ created: 0, updated: 1 });
    expect(db.payments.size).toBe(1);
    const after = [...db.payments.values()][0];
    expect(after).toMatchObject({ customerName: "Sara Khan (edited)", partnerAccountId: "m", orderNumber: "MY-1", amountFils: 10000 });
  });

  it("applies refunds from refund balance transactions (full refund → refunded)", async () => {
    stripeApi.txns = [bt({ source: charge() })];
    await syncStripe();
    stripeApi.charges.set("ch_1", charge({ refunded: true, amount_refunded: 10000 }));
    stripeApi.txns = [bt({ id: "txn_r", type: "refund", amount: -10000, fee: 0, source: { id: "re_1", object: "refund", charge: "ch_1" } })];
    const s = await syncStripe();
    expect(s.refundsUpdated).toBe(1);
    expect([...db.payments.values()][0]).toMatchObject({ status: "refunded", amountRefundedFils: 10000 });
  });
});
