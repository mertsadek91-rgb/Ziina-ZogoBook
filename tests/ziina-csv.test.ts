import { describe, expect, it } from "vitest";
import { isZiinaExport, mapZiinaExport, parseZiinaDate } from "@/lib/ziina-csv";
import { intentToPaymentFields } from "@/lib/ziina";

const HEADERS = [
  "Time", "Transaction ID", "Type", "Currency", "Amount", "Amount Received", "Fee", "Waived Fee", "Tip",
  "Customer VAT", "Message", "Performed By", "Invoice Number", "ZiiLink Reference", "Customer",
  "Customer Username", "Customer Card Number", "Customer Email", "Customer Phone Number",
];

const row = (o: Record<string, string>) => Object.fromEntries(HEADERS.map((h) => [h, o[h] ?? ""]));

describe("Ziina CSV export", () => {
  it("is recognised by its headers", () => {
    expect(isZiinaExport(HEADERS)).toBe(true);
    expect(isZiinaExport(["id", "amount"])).toBe(false);
  });

  it("parses DD/MM/YYYY as Dubai time and never as MM/DD", () => {
    expect(parseZiinaDate("25/09/2026 01:15:32")).toBe("2026-09-25T01:15:32+04:00");
    expect(parseZiinaDate("08/09/2026 18:06:23")).toBe("2026-09-08T18:06:23+04:00"); // 8 Sep, not 9 Aug
    expect(new Date(parseZiinaDate("25/09/2026 01:15:32")!).toISOString()).toBe("2026-09-24T21:15:32.000Z");
    expect(parseZiinaDate("2026-09-25")).toBeUndefined();
  });

  it("skips withdrawals, maps order number/phone/card and uses the fee actually charged", () => {
    const { rows, skipped, problems } = mapZiinaExport([
      row({ Time: "25/09/2026 01:15:32", "Transaction ID": "t1", Type: "Invoice", Currency: "AED", Amount: "165.15",
        "Amount Received": "156.99", Fee: "8.16", "Waived Fee": "0", Tip: "0", "Invoice Number": "333136",
        Customer: "Test Customer ", "Customer Card Number": "**** **** **** 0690", "Customer Email": "a@b.com",
        "Customer Phone Number": "" }),
      row({ Time: "24/09/2026 23:41:58", "Transaction ID": "w1", Type: "Withdrawal", Amount: "2423.97" }),
      row({ Time: "08/09/2026 17:17:04", "Transaction ID": "t2", Type: "Invoice", Currency: "AED", Amount: "220",
        "Amount Received": "215.34", Fee: "10.52", "Waived Fee": "5.86", "Invoice Number": "333349",
        "Customer Phone Number": "8733538974" }),
      row({ Time: "05/09/2026 01:04:27", "Transaction ID": "t3", Type: "Invoice", Currency: "AED", Amount: "220",
        "Amount Received": "220", Fee: "10.52", "Waived Fee": "10.52", "Customer Phone Number": "undefined" }),
    ]);
    expect(skipped).toEqual({ Withdrawal: 1 });
    expect(problems).toEqual([]);
    expect(rows.map((r) => r.ziinaIntentId)).toEqual(["t1", "t2", "t3"]);
    expect(rows[0]).toMatchObject({ amount: "165.15", fee: "8.16", orderNumber: "333136", customerName: "Test Customer",
      cardLast4: "0690", customerEmail: "a@b.com", customerPhone: undefined });
    expect(rows[1]).toMatchObject({ fee: "4.66", customerPhone: "8733538974" }); // 10.52 − 5.86 waived
    expect(rows[2]).toMatchObject({ fee: "0", customerPhone: undefined }); // fully waived, "undefined" ignored
    // Fee − waived always equals what Ziina kept: Amount + Tip − Amount Received.
    expect(Number(rows[1].amount) - 215.34).toBeCloseTo(Number(rows[1].fee), 2);
  });
});

describe("intentToPaymentFields with foreign cards", () => {
  it("invoices the settled AED amount and keeps what the customer paid", () => {
    const f = intentToPaymentFields({
      id: "x", amount: 10608, currency_code: "USD", created_at: "1790000000000", status: "completed", fee_amount: 1762,
      settled: { amount: 38500, tip_amount: 0, currency_code: "AED" },
    });
    expect(f).toMatchObject({ amountFils: 38500, currency: "AED", originalAmountFils: 10608, originalCurrency: "USD", feeFils: 1762 });
  });
  it("leaves AED payments unchanged", () => {
    const f = intentToPaymentFields({
      id: "y", amount: 23900, currency_code: "AED", created_at: "1790000000000", status: "completed",
      settled: { amount: 23900, currency_code: "AED" },
    });
    expect(f).toMatchObject({ amountFils: 23900, currency: "AED", originalAmountFils: null, originalCurrency: null });
  });
});
