import { describe, expect, it } from "vitest";
import { buildIndex, matchPayment, type LocalPayment, type ZInvoice, type ZPayment } from "@/lib/reconcile-match";

const local: LocalPayment = {
  ziinaIntentId: "3cf42a6f-ae13-43a7-8eed-632a67507e8d",
  grossFils: 22000, // 220 AED
  feeFils: 640,
  date: "2026-09-14",
  customerName: "Ahmed Ali",
  customerEmail: "ahmed@x.com",
};

const inv = (o: Partial<ZInvoice>): ZInvoice => ({
  invoice_id: "i1",
  invoice_number: "INV-000010",
  reference_number: "",
  date: "2026-09-14",
  total: 220,
  balance: 0,
  status: "paid",
  customer_id: "c1",
  customer_name: "Ahmed Ali",
  email: "ahmed@x.com",
  ...o,
});
const pay = (o: Partial<ZPayment>): ZPayment => ({
  payment_id: "p1",
  reference_number: "",
  date: "2026-09-14",
  amount: 220,
  customer_id: "c1",
  customer_name: "Ahmed Ali",
  invoice_numbers: "INV-000010",
  ...o,
});

describe("matchPayment", () => {
  it("links exactly by reference number", () => {
    const idx = buildIndex([inv({ reference_number: local.ziinaIntentId })], [pay({ reference_number: local.ziinaIntentId })]);
    const r = matchPayment(local, idx);
    expect(r).toMatchObject({ kind: "linked", via: "reference", invoice: { invoice_id: "i1" }, payment: { payment_id: "p1" } });
  });

  it("finds the invoice through the payment when only the payment carries the reference", () => {
    const idx = buildIndex([inv({})], [pay({ reference_number: local.ziinaIntentId })]);
    const r = matchPayment(local, idx);
    expect(r).toMatchObject({ kind: "linked", invoice: { invoice_number: "INV-000010" } });
  });

  it("suggests a manual entry with the same amount, date and customer (never auto-links)", () => {
    const idx = buildIndex([inv({})], [pay({})]);
    const r = matchPayment(local, idx);
    expect(r.kind).toBe("candidates");
    if (r.kind !== "candidates") return;
    expect(r.candidates).toHaveLength(1); // the invoice is covered by the payment candidate
    expect(r.candidates[0]).toMatchObject({ kind: "payment", paymentId: "p1", invoiceNumber: "INV-000010" });
    expect(r.candidates[0].reasons).toEqual(expect.arrayContaining(["نفس المبلغ", "نفس اليوم", "نفس الإيميل"]));
  });

  it("matches the net amount (after Ziina fee) too", () => {
    const idx = buildIndex([], [pay({ amount: 213.6, invoice_numbers: "" })]);
    const r = matchPayment(local, idx);
    expect(r.kind === "candidates" && r.candidates[0].reasons).toContain("نفس المبلغ بعد خصم رسوم Ziina");
  });

  it("ignores different amounts, far dates, used, rejected, and other Ziina payments", () => {
    const idx = buildIndex(
      [],
      [
        pay({ payment_id: "a", amount: 221 }),
        pay({ payment_id: "b", date: "2026-09-25" }),
        pay({ payment_id: "c" }),
        pay({ payment_id: "d" }),
        pay({ payment_id: "e", reference_number: "11111111-2222-3333-4444-555555555555" }),
      ],
    );
    const r = matchPayment(local, idx, { usedIds: new Set(["c"]), ignoredIds: new Set(["d"]) });
    expect(r.kind).toBe("none");
  });

  it("ranks the better candidate first", () => {
    const idx = buildIndex(
      [],
      [
        pay({ payment_id: "weak", date: "2026-09-16", customer_name: "Someone", invoice_numbers: "" }),
        pay({ payment_id: "strong", invoice_numbers: "" }),
      ],
    );
    const r = matchPayment(local, idx);
    expect(r.kind === "candidates" && r.candidates.map((c) => c.paymentId)).toEqual(["strong", "weak"]);
  });

  it("reports a previously linked invoice that disappeared", () => {
    const idx = buildIndex([], []);
    expect(matchPayment({ ...local, zohoInvoiceId: "gone" }, idx)).toEqual({
      kind: "missing",
      lostInvoice: true,
      lostPayment: false,
    });
  });
});
