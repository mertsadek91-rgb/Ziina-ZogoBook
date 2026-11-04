import { describe, expect, it } from "vitest";
import { refundToSettledFils } from "@/lib/refund";

// USD 50.00 paid, settled as AED 181.42
const p = { amountFils: 18142, tipFils: 0, originalAmountFils: 5000, originalCurrency: "USD" };

describe("refundToSettledFils", () => {
  it("converts a refund in the customer's currency at the payment's rate", () => {
    expect(refundToSettledFils(p, 45, "USD")).toBe(16328); // 181.42 × 45/50
    expect(18142 - refundToSettledFils(p, 45, "USD")).toBe(1814); // AED 18.14 left = USD 5
  });
  it("takes AED as is", () => {
    expect(refundToSettledFils(p, "163.28", "AED")).toBe(16328);
  });
  it("refuses a currency it cannot convert", () => {
    expect(() => refundToSettledFils(p, 10, "EUR")).toThrow();
  });
});
