import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatMoney, fromFils, fromMinor, toFils, toMinor } from "@/lib/money";
import { verifyHmac, intentToPaymentFields } from "@/lib/ziina";
import { tabOf } from "@/lib/status";
import { matchContact } from "@/lib/contacts";
import { createSessionToken, verifySessionToken } from "@/lib/auth";
import { normalizeOrderNumber, zohoNote } from "@/lib/order";

describe("order number", () => {
  it("normalizes what the user types", () => {
    expect(normalizeOrderNumber("#333136")).toBe("333136");
    expect(normalizeOrderNumber("  ##333136 ")).toBe("333136");
    expect(normalizeOrderNumber("   ")).toBeNull();
    expect(normalizeOrderNumber(undefined)).toBeNull();
  });
  it("builds the Zoho note with or without an order number", () => {
    expect(zohoNote("pi", "333136")).toBe("Ziina Order #333136\nZiina payment pi");
    expect(zohoNote("pi", null)).toBe("Ziina payment pi");
  });
});

describe("currencies", () => {
  it("uses base units per currency and rounds 3-decimal currencies to the nearest ten", () => {
    expect(toMinor(100, "SAR")).toBe(10000);
    expect(toMinor("10.50", "USD")).toBe(1050);
    expect(toMinor(1.234, "OMR")).toBe(1230);
    expect(toMinor(1.236, "KWD")).toBe(1240);
    expect(toMinor(5, "BHD")).toBe(5000);
    expect(fromMinor(1230, "OMR")).toBe(1.23);
    expect(formatMoney(1240, "KWD")).toBe("1.240 KWD");
    expect(formatMoney(17090, "SAR")).toBe("170.90 SAR");
  });
});

describe("money", () => {
  it("converts AED ↔ fils without float drift", () => {
    expect(toFils(100)).toBe(10000);
    expect(toFils("19.99")).toBe(1999);
    expect(toFils("1,250.50")).toBe(125050);
    expect(toFils(0.1 + 0.2)).toBe(30);
    expect(fromFils(1999)).toBe(19.99);
    expect(formatMoney(125050)).toBe("1,250.50 AED");
  });
  it("rejects garbage", () => {
    expect(() => toFils("abc")).toThrow();
  });
});

describe("ziina hmac", () => {
  const secret = "s3cret";
  const body = JSON.stringify({ event: "payment_intent.status.updated", data: { id: "pi_1" } });
  const sig = crypto.createHmac("sha256", secret).update(body).digest("hex");
  it("accepts a valid signature", () => expect(verifyHmac(body, sig, secret)).toBe(true));
  it("accepts uppercase hex", () => expect(verifyHmac(body, sig.toUpperCase(), secret)).toBe(true));
  it("rejects tampered body", () => expect(verifyHmac(body + " ", sig, secret)).toBe(false));
  it("rejects missing/short signature", () => {
    expect(verifyHmac(body, null, secret)).toBe(false);
    expect(verifyHmac(body, "abcd", secret)).toBe(false);
  });
});

describe("intentToPaymentFields", () => {
  it("maps ms timestamps and card details", () => {
    const f = intentToPaymentFields({
      id: "pi",
      amount: 5000,
      currency_code: "AED",
      created_at: "1735689600000",
      status: "completed",
      fee_amount: 145,
      card_details: { brand: "VISA", last4: "4242" },
    });
    expect(f.createdAtZiina?.toISOString()).toBe("2025-01-01T00:00:00.000Z");
    expect(f.feeFils).toBe(145);
    expect(f.cardLast4).toBe("4242");
  });
});

describe("tabOf", () => {
  it("derives the list tab from both statuses", () => {
    expect(tabOf({ status: "requires_payment_instrument", zohoStatus: "not_synced" })).toBe("pending");
    expect(tabOf({ status: "completed", zohoStatus: "not_synced" })).toBe("to_invoice");
    expect(tabOf({ status: "completed", zohoStatus: "contact_ready" })).toBe("to_invoice");
    expect(tabOf({ status: "completed", zohoStatus: "invoiced" })).toBe("invoiced");
    expect(tabOf({ status: "completed", zohoStatus: "paid" })).toBe("done");
    expect(tabOf({ status: "completed", zohoStatus: "error" })).toBe("errors");
    expect(tabOf({ status: "canceled", zohoStatus: "not_synced" })).toBe("failed");
  });
});

describe("matchContact", () => {
  const list = [
    { contact_id: "1", contact_name: "Ahmed Ali", email: "AHMED@x.com" },
    { contact_id: "2", contact_name: "Sara", phone: "+971 50 123 4567" },
    { contact_id: "3", contact_name: "Ahmed Alim", email: "ahmed.alim@x.com" },
  ];
  it("matches email case-insensitively and exactly", () => {
    expect(matchContact(list, { email: "ahmed@x.com" })?.contact_id).toBe("1");
    expect(matchContact(list, { email: "ahmed@x.co" })).toBeUndefined();
  });
  it("matches phone ignoring formatting / country prefix", () => {
    expect(matchContact(list, { phone: "00971501234567" })?.contact_id).toBe("2");
    expect(matchContact(list, { phone: "050 123 4567" })?.contact_id).toBe("2");
  });
  it("matches exact name only (no partials)", () => {
    expect(matchContact(list, { name: "ahmed ali" })?.contact_id).toBe("1");
    expect(matchContact(list, { name: "Ahmed" })).toBeUndefined();
  });
});

describe("session token", () => {
  it("verifies its own tokens and rejects others", async () => {
    const t = await createSessionToken("k1");
    expect(await verifySessionToken(t, "k1")).toBe(true);
    expect(await verifySessionToken(t, "k2")).toBe(false);
    expect(await verifySessionToken("123.abc", "k1")).toBe(false);
    expect(await verifySessionToken(undefined, "k1")).toBe(false);
  });
});
