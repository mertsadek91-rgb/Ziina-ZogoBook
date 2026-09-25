import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- In-memory fakes for the DB, Ziina and Zoho ----
type Row = Record<string, unknown>;
const store = { payments: new Map<string, Row>(), logs: [] as Row[] };

vi.mock("@/lib/db", () => {
  const payment = {
    findMany: async ({ where }: { where: Record<string, any> }) => {
      const all = [...store.payments.values()];
      if (where.id?.in) return all.filter((p) => where.id.in.includes(p.id) && p.status === "completed").map((p) => ({ ...p }));
      if (where.OR) return all.filter((p) => p.zohoInvoiceId || p.zohoPaymentId).map((p) => ({ ...p }));
      return all.filter((p) => p.status === "completed").map((p) => ({ ...p }));
    },
    findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
      const p = store.payments.get(where.id);
      if (!p) throw new Error("not found");
      return { ...p };
    },
    update: async ({ where, data }: { where: { id: string }; data: Row }) => {
      const p = { ...store.payments.get(where.id)!, ...data };
      store.payments.set(where.id, p);
      return { ...p };
    },
  };
  return {
    prisma: { payment, syncLog: { create: async ({ data }: { data: Row }) => store.logs.push(data) } },
    getSetting: async () => "acc_ziina",
  };
});

const ziinaStatus = { value: "completed" };
vi.mock("@/lib/ziina", () => ({
  getPaymentIntent: async (id: string) => ({ id, amount: 10000, currency_code: "AED", status: ziinaStatus.value, fee_amount: 300 }),
  intentToPaymentFields: (pi: { amount: number; status: string; fee_amount: number }) => ({
    amountFils: pi.amount,
    status: pi.status,
    feeFils: pi.fee_amount,
    tipFils: 0,
    createdAtZiina: null,
  }),
}));

const zohoState = {
  contacts: [] as { contact_id: string; contact_name: string; email?: string }[],
  invoices: [] as { invoice_id: string; invoice_number: string; reference_number: string; customer_id: string; balance: number }[],
  payments: [] as { payment_id: string; reference_number: string; amount: number }[],
  failPaymentOnce: false,
  calls: [] as string[],
  lastNotes: "" as string | undefined,
};

vi.mock("@/lib/zoho", () => {
  class ZohoError extends Error {
    body = { code: 1 };
  }
  return {
    ZohoError,
    searchContacts: async (q: { email?: string }) => {
      zohoState.calls.push("searchContacts");
      return zohoState.contacts.filter((c) => !q.email || c.email === q.email);
    },
    createContact: async (i: { name: string; email?: string }) => {
      zohoState.calls.push("createContact");
      const c = { contact_id: `c${zohoState.contacts.length + 1}`, contact_name: i.name, email: i.email };
      zohoState.contacts.push(c);
      return c;
    },
    findInvoicesByReference: async (ref: string) => zohoState.invoices.filter((i) => i.reference_number === ref),
    createInvoice: async (i: { customerId: string; referenceNumber: string; rate: number; notes?: string }) => {
      zohoState.calls.push(`createInvoice:${i.rate}`);
      zohoState.lastNotes = i.notes;
      const inv = {
        invoice_id: `inv${zohoState.invoices.length + 1}`,
        invoice_number: `INV-00${zohoState.invoices.length + 1}`,
        reference_number: i.referenceNumber,
        customer_id: i.customerId,
        balance: i.rate,
      };
      zohoState.invoices.push(inv);
      return inv;
    },
    markInvoiceSent: async () => zohoState.calls.push("markSent"),
    findPaymentsByReference: async (ref: string) => zohoState.payments.filter((p) => p.reference_number === ref),
    createCustomerPayment: async (i: { referenceNumber: string; amount: number; bankCharges: number; accountId: string }) => {
      if (zohoState.failPaymentOnce) {
        zohoState.failPaymentOnce = false;
        throw new ZohoError("Zoho: temporary failure");
      }
      zohoState.calls.push(`createPayment:${i.amount}:${i.bankCharges}:${i.accountId}`);
      const p = { payment_id: `pay${zohoState.payments.length + 1}`, reference_number: i.referenceNumber, amount: i.amount };
      zohoState.payments.push(p);
      return p;
    },
    emailInvoice: async () => zohoState.calls.push("email"),
    listInvoicesInRange: async () => zohoState.invoices.map((i) => ({ date: "2026-09-20", total: i.balance, ...i })),
    listPaymentsInRange: async () =>
      zohoState.payments.map((p) => ({ date: "2026-09-20", customer_id: "c1", ...p })),
    getInvoice: async (id: string) => zohoState.invoices.find((i) => i.invoice_id === id),
    getCustomerPayment: async (id: string) => zohoState.payments.find((p) => p.payment_id === id),
    isNotFound: () => true,
  };
});

import { syncToZoho } from "@/lib/sync";
import { reconcile, ignoreCandidates } from "@/lib/reconcile";

function seed(extra: Row = {}) {
  store.payments.set("p1", {
    id: "p1",
    ziinaIntentId: "pi_123",
    amountFils: 10000,
    tipFils: 0,
    feeFils: 300,
    status: "completed",
    source: "api",
    message: "Consulting",
    customerName: "Ahmed Ali",
    customerEmail: "ahmed@x.com",
    customerPhone: null,
    paidAt: new Date("2026-09-20T10:00:00Z"),
    createdAt: new Date("2026-09-20T09:00:00Z"),
    zohoStatus: "not_synced",
    zohoContactId: null,
    zohoInvoiceId: null,
    zohoPaymentId: null,
    emailSent: false,
    zohoCandidates: null,
    zohoCandidateCount: 0,
    zohoIgnoredIds: "",
    ...extra,
  });
}

beforeEach(() => {
  store.payments.clear();
  store.logs = [];
  zohoState.contacts = [];
  zohoState.invoices = [];
  zohoState.payments = [];
  zohoState.calls = [];
  zohoState.failPaymentOnce = false;
  ziinaStatus.value = "completed";
});

describe("syncToZoho", () => {
  it("creates contact, invoice and payment with fee as bank charges; no email by default", async () => {
    seed();
    const r = await syncToZoho("p1", { itemId: "item1" });
    expect(r.ok).toBe(true);
    expect(r.payment.zohoStatus).toBe("paid");
    expect(zohoState.calls).toEqual([
      "searchContacts", // by email
      "searchContacts", // by name
      "createContact",
      "createInvoice:100",
      "markSent",
      "createPayment:100:3:acc_ziina",
    ]);
    expect(zohoState.calls).not.toContain("email");
  });

  it("reuses an existing contact matched by email", async () => {
    seed();
    zohoState.contacts.push({ contact_id: "existing", contact_name: "A. Ali", email: "ahmed@x.com" });
    const r = await syncToZoho("p1", { itemId: "item1" });
    expect(r.payment.zohoContactId).toBe("existing");
    expect(zohoState.calls).not.toContain("createContact");
  });

  it("is idempotent: a second run creates nothing new", async () => {
    seed();
    await syncToZoho("p1", { itemId: "item1" });
    // Simulate local state loss: Zoho still has the invoice/payment by reference.
    store.payments.set("p1", { ...store.payments.get("p1")!, zohoInvoiceId: null, zohoPaymentId: null, zohoStatus: "contact_ready" });
    zohoState.calls = [];
    const r = await syncToZoho("p1", { itemId: "item1" });
    expect(r.ok).toBe(true);
    expect(zohoState.calls.filter((c) => c.startsWith("create"))).toEqual([]);
    expect(zohoState.invoices).toHaveLength(1);
    expect(zohoState.payments).toHaveLength(1);
  });

  it("stops on failure and resumes from the failed step", async () => {
    seed();
    zohoState.failPaymentOnce = true;
    const r1 = await syncToZoho("p1", { itemId: "item1" });
    expect(r1.ok).toBe(false);
    expect(r1.payment.zohoStatus).toBe("error");
    expect(r1.payment.zohoInvoiceId).toBe("inv1");
    expect(r1.payment.lastError).toContain("[payment]");

    const r2 = await syncToZoho("p1", { itemId: "item1" });
    expect(r2.ok).toBe(true);
    expect(zohoState.invoices).toHaveLength(1);
    expect(r2.payment.zohoStatus).toBe("paid");
  });

  it("refuses to invoice a payment that is not completed in Ziina", async () => {
    seed();
    ziinaStatus.value = "pending";
    const r = await syncToZoho("p1", { itemId: "item1" });
    expect(r.ok).toBe(false);
    expect(zohoState.calls).toEqual([]);
  });

  it("requires a customer name or email", async () => {
    seed({ customerName: null, customerEmail: null });
    const r = await syncToZoho("p1", { itemId: "item1" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/اسم العميل/);
  });

  it("writes the Ziina order number into the invoice notes and saves it", async () => {
    seed();
    const r = await syncToZoho("p1", { itemId: "item1", orderNumber: " #333136 " });
    expect(r.ok).toBe(true);
    expect(r.payment.orderNumber).toBe("333136");
    expect(zohoState.lastNotes).toBe("Ziina Order #333136\nZiina payment pi_123");
  });

  it("refuses test payments in live mode and hidden payments, without marking an error", async () => {
    seed({ test: true });
    const r1 = await syncToZoho("p1", { itemId: "item1" });
    expect(r1.ok).toBe(false);
    expect(r1.payment.zohoStatus).toBe("not_synced");
    seed({ archived: true });
    const r2 = await syncToZoho("p1", { itemId: "item1" });
    expect(r2.ok).toBe(false);
    expect(zohoState.calls).toEqual([]);
  });

  it("sends the email only when asked", async () => {
    seed();
    const r = await syncToZoho("p1", { itemId: "item1", sendEmail: true });
    expect(r.payment.emailSent).toBe(true);
    expect(zohoState.calls).toContain("email");
  });
});

describe("reconcile", () => {
  it("picks up an invoice created manually in Zoho with the Ziina reference", async () => {
    seed();
    zohoState.invoices.push({ invoice_id: "m1", invoice_number: "INV-900", reference_number: "pi_123", customer_id: "c9", balance: 100 });
    await reconcile({ ids: ["p1"] });
    const p = store.payments.get("p1")!;
    expect(p.zohoStatus).toBe("invoiced");
    expect(p.zohoInvoiceNumber).toBe("INV-900");
  });

  it("blocks invoicing when a similar manual payment exists, until the user reviews it", async () => {
    seed();
    // Manual entry in Zoho: same amount/day, no reference.
    zohoState.invoices.push({ invoice_id: "m2", invoice_number: "INV-010", reference_number: "", customer_id: "c1", balance: 0 });
    zohoState.payments.push({ payment_id: "zp1", reference_number: "", amount: 100, invoice_numbers: "INV-010" } as never);

    const r1 = await syncToZoho("p1", { itemId: "item1" });
    expect(r1.ok).toBe(false);
    expect(r1.error).toMatch(/مطابقة محتملة/);
    expect(zohoState.calls.filter((c) => c.startsWith("create"))).toEqual([]);
    expect(store.payments.get("p1")!.zohoStatus).toBe("not_synced"); // not an error — goes to review

    await ignoreCandidates("p1");
    const r2 = await syncToZoho("p1", { itemId: "item1" });
    expect(r2.ok).toBe(true);
    expect(r2.payment.zohoStatus).toBe("paid");
  });

  it("detects that a linked invoice was deleted in Zoho", async () => {
    seed({ zohoStatus: "paid", zohoInvoiceId: "gone", zohoInvoiceNumber: "INV-1", zohoPaymentId: null, zohoContactId: "c1" });
    zohoState.invoices.push({ invoice_id: "other", invoice_number: "INV-2", reference_number: "", customer_id: "c1", balance: 5 });
    await reconcile({ ids: ["p1"] });
    const p = store.payments.get("p1")!;
    expect(p.zohoInvoiceId).toBeNull();
    expect(p.zohoStatus).toBe("contact_ready");
    expect(String(p.lastError)).toMatch(/حذف/);
  });
});
