import { describe, expect, it } from "vitest";
import { wooMismatch } from "@/lib/woo-sync";

describe("wooMismatch", () => {
  it("agrees when both sides are paid or both unpaid", () => {
    expect(wooMismatch("processing", "completed")).toBeNull();
    expect(wooMismatch("completed", "completed")).toBeNull();
    expect(wooMismatch("pending", "requires_payment_instrument")).toBeNull();
    expect(wooMismatch("failed", "failed")).toBeNull();
  });
  it("flags a Ziina payment the site never marked paid", () => {
    expect(wooMismatch("pending", "completed")).toBe("paid_not_in_site");
    expect(wooMismatch("on-hold", "completed")).toBe("paid_not_in_site");
  });
  it("flags money received on a cancelled order", () => {
    expect(wooMismatch("cancelled", "completed")).toBe("paid_not_in_site");
  });
  it("flags a paid site order without a completed Ziina payment", () => {
    expect(wooMismatch("processing", "pending")).toBe("site_paid_not_in_ziina");
  });
});
