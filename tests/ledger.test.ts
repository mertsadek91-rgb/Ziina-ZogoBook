import { describe, expect, it } from "vitest";
import { accountBalance, allocate, partnerStatements, periodReport, validateEntry, type AccountLite, type EntryLite, type SaleLite } from "@/lib/ledger-calc";
import { guessColumns, lineText, parseAmount, parseBankDate, parseStatement, suggestBooking } from "@/lib/bank-csv";

const d = (s: string) => new Date(`${s}T12:00:00+04:00`);

const ACC: AccountLite[] = [
  { id: "z", key: "ziina", name: "Ziina", kind: "gateway", openingFils: 0 },
  { id: "w", key: "wio", name: "Wio Bank", kind: "bank", openingFils: 0 },
  { id: "m", key: "partner_mert", name: "Mert Sadek", kind: "partner", openingFils: 0 },
  { id: "n", key: "partner_nawras", name: "Nawras Tutunji", kind: "partner", openingFils: 0 },
];

// Sept: 3 sales (one unassigned). Oct: 1 sale.
const SALES: SaleLite[] = [
  { date: d("2026-09-05"), grossFils: 100000, feeFils: 5000, partnerAccountId: "m" }, // net 950
  { date: d("2026-09-10"), grossFils: 50000, feeFils: 2500, partnerAccountId: "n" }, // net 475
  { date: d("2026-09-12"), grossFils: 20000, feeFils: 1000, partnerAccountId: null }, // net 190, unassigned
  { date: d("2026-10-02"), grossFils: 30000, feeFils: 1500, partnerAccountId: "m" }, // net 285
];

const ENTRIES: EntryLite[] = [
  { date: d("2026-09-15"), kind: "transfer", amountFils: 140000, feeFils: 0, fromAccountId: "z", toAccountId: "w" }, // withdraw 1400
  { date: d("2026-09-16"), kind: "transfer", amountFils: 120000, feeFils: 500, fromAccountId: "w", toAccountId: "m" }, // Mert gets 1200 (+5 fee)
  { date: d("2026-09-17"), kind: "transfer", amountFils: 40000, feeFils: 0, fromAccountId: "w", toAccountId: "n" }, // Nawras gets 400
  { date: d("2026-09-18"), kind: "expense", amountFils: 10000, feeFils: 0, fromAccountId: "w", category: "ads" }, // 100 ads from bank
  { date: d("2026-09-19"), kind: "expense", amountFils: 3000, feeFils: 0, fromAccountId: "n", category: "subscriptions" }, // Nawras paid 30
  { date: d("2026-09-20"), kind: "bank_fee", amountFils: 1500, feeFils: 0, fromAccountId: "w" }, // 15
  { date: d("2026-09-21"), kind: "income", amountFils: 5000, feeFils: 0, toAccountId: "w" }, // 50 other income
];

describe("periodReport", () => {
  const r = periodReport(ACC, ENTRIES, SALES, d("2026-09-01"), new Date("2026-09-30T23:59:59+04:00"));
  it("sums sales, gateway fees, bank fees (incl. transfer fees) and expenses for the period", () => {
    expect(r.salesCount).toBe(3);
    expect(r.sales).toBe(170000);
    expect(r.gatewayFees).toBe(8500);
    expect(r.netReceived).toBe(161500);
    expect(r.bankFees).toBe(2000); // 15 + 5 transfer fee
    expect(r.expenses).toBe(13000);
    expect(r.expensesByCategory).toEqual([
      { category: "ads", amount: 10000 },
      { category: "subscriptions", amount: 3000 },
    ]);
    expect(r.otherIncome).toBe(5000);
    expect(r.gatewayWithdrawals).toBe(140000);
    // 1700 + 50 − 85 − 20 − 130 = 1515
    expect(r.netProfit).toBe(151500);
  });
  it("excludes movements outside the period", () => {
    const oct = periodReport(ACC, ENTRIES, SALES, d("2026-10-01"), d("2026-10-31"));
    expect(oct.sales).toBe(30000);
    expect(oct.expenses).toBe(0);
  });
});

describe("accountBalance", () => {
  it("computes Ziina, bank and partner balances", () => {
    const asOf = new Date("2026-09-30T23:59:59+04:00");
    // Ziina: 950 + 475 + 190 − 1400 withdrawn = 215
    expect(accountBalance(ACC[0], ENTRIES, SALES, asOf)).toBe(21500);
    // Wio: +1400 − 1205 − 400 − 100 − 15 + 50 = −270
    expect(accountBalance(ACC[1], ENTRIES, SALES, asOf)).toBe(-27000);
    // Mert fund: received 1200
    expect(accountBalance(ACC[2], ENTRIES, SALES, asOf)).toBe(120000);
    // Nawras fund: received 400 − paid 30 expense = 370
    expect(accountBalance(ACC[3], ENTRIES, SALES, asOf)).toBe(37000);
  });
  it("ignores movements before the opening date (already in the opening balance)", () => {
    const wio = { ...ACC[1], openingFils: 500000, openingDate: d("2026-09-17") };
    // from 17 Sep 00:00: −400 − 100 − 15 + 50 = −465 → 5000 − 465
    expect(accountBalance(wio, ENTRIES, SALES, new Date("2026-09-30T23:59:59+04:00"))).toBe(453500);
  });
});

describe("partnerStatements", () => {
  it("deducts shared costs from the base in proportion to each partner's payments", () => {
    const { partners, unassigned, sharedCosts } = partnerStatements(ACC, ENTRIES, SALES, new Date("2026-09-30T23:59:59+04:00"));
    // bank fee 15 + transfer fee 5 + expenses 100 + 30 − other income 50 = 100 AED
    expect(sharedCosts).toBe(10000);
    const mert = partners.find((p) => p.accountId === "m")!;
    const nawras = partners.find((p) => p.accountId === "n")!;
    // Weights 950 : 475 → Mert bears 2/3 (66.67), Nawras 1/3 (33.33); parts add up exactly.
    expect(mert.costShare + nawras.costShare).toBe(10000);
    // Mert: 950 − 66.67 = 883.33 due, received 1200 → −316.67 (received more than due)
    expect(mert).toMatchObject({ entitledFromPayments: 95000, costShare: 6667, due: 88333, received: 120000, remaining: -31667 });
    // Nawras: 475 + 30 paid personally − 33.33 = 471.67 due, received 400 → 71.67 still owed
    expect(nawras).toMatchObject({ entitledFromPayments: 47500, expensesPaid: 3000, costShare: 3333, due: 47167, received: 40000, remaining: 7167 });
    expect(unassigned).toEqual({ count: 1, net: 19000 });
  });

  it("reconciles with the company: Σ remaining = assigned profit + money partners put in − transfers to them", () => {
    const to = new Date("2026-09-30T23:59:59+04:00");
    const { partners, unassigned } = partnerStatements(ACC, ENTRIES, SALES, to);
    const r = periodReport(ACC, ENTRIES, SALES, null, to);
    const sum = (k: "remaining" | "expensesPaid" | "paidIn" | "received") => partners.reduce((a, p) => a + p[k], 0);
    expect(sum("remaining")).toBe(r.netProfit - unassigned.net + sum("expensesPaid") + sum("paidIn") - sum("received"));
  });

  it("is cumulative up to the date (October sale adds to Mert and shifts the cost split)", () => {
    const { partners } = partnerStatements(ACC, ENTRIES, SALES, null);
    // weights 1235 : 475 → Mert 72.22, Nawras 27.78
    expect(partners.find((p) => p.accountId === "m")!).toMatchObject({ costShare: 7222, remaining: 123500 - 7222 - 120000 });
  });

  it("allocates exactly with largest-remainder rounding", () => {
    expect(allocate(9542, [102015, 896841])).toEqual([975, 8567]); // the real Sep 2026 case: 95.42 AED
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(100, [0, 0])).toEqual([50, 50]);
    expect(allocate(-358, [1, 1])).toEqual([-179, -179]);
    expect(allocate(0, [5, 7])).toEqual([0, 0]);
  });
});

describe("validateEntry", () => {
  it("requires the right accounts per kind", () => {
    expect(validateEntry({ kind: "transfer", amountFils: 100, fromAccountId: "a", toAccountId: "a" })).toBe("same_account");
    expect(validateEntry({ kind: "transfer", amountFils: 100, fromAccountId: "a" })).toBe("accounts");
    expect(validateEntry({ kind: "expense", amountFils: 100 })).toBe("accounts");
    expect(validateEntry({ kind: "income", amountFils: 100, toAccountId: "w" })).toBeNull();
    expect(validateEntry({ kind: "expense", amountFils: 0, fromAccountId: "w" })).toBe("amount");
  });
});

describe("bank statement CSV", () => {
  it("guesses columns (single amount or debit/credit)", () => {
    expect(guessColumns(["Date", "Description", "Amount", "Balance", "Reference"])).toEqual({
      date: "Date", description: "Description", amount: "Amount", balance: "Balance", reference: "Reference",
    });
    expect(guessColumns(["Transaction Date", "Details", "Debit", "Credit", "Running Balance"])).toMatchObject({
      date: "Transaction Date", description: "Details", debit: "Debit", credit: "Credit", balance: "Running Balance",
    });
  });

  it("parses dates in Dubai time without MM/DD guessing, and amounts in common formats", () => {
    expect(parseBankDate("08/09/2026")).toBe("2026-09-08T00:00:00+04:00");
    expect(parseBankDate("2026-09-25 14:05")).toBe("2026-09-25T14:05:00+04:00");
    expect(parseBankDate("25 Sep 2026")).toBe("2026-09-25T00:00:00+04:00");
    expect(parseBankDate("25-Sept-2026")).toBe("2026-09-25T00:00:00+04:00");
    expect(parseBankDate("13/13/2026")).toBeUndefined();
    expect(parseAmount("1,234.50")).toBe(1234.5);
    expect(parseAmount("-1,234.50")).toBe(-1234.5);
    expect(parseAmount("(99.90)")).toBe(-99.9);
    expect(parseAmount("AED 10.00 DR")).toBe(-10);
    expect(parseAmount("")).toBeUndefined();
  });

  it("builds signed lines, closing balance and stable ids (identical lines stay distinct)", () => {
    const recs = [
      { Date: "24/09/2026", Description: "ZIINA FZ LLC payout", Debit: "", Credit: "2,423.97", Balance: "3,000.00" },
      { Date: "25/09/2026", Description: "Transfer to MERT SADEK", Debit: "1,000.00", Credit: "", Balance: "2,000.00" },
      { Date: "25/09/2026", Description: "Card fee", Debit: "5.00", Credit: "", Balance: "1,995.00" },
      { Date: "25/09/2026", Description: "Card fee", Debit: "5.00", Credit: "", Balance: "1,990.00" },
      { Date: "", Description: "", Debit: "", Credit: "", Balance: "" },
    ];
    const map = guessColumns(Object.keys(recs[0]));
    const r = parseStatement(recs, map);
    expect(r.problems).toEqual([]);
    expect(r.lines.map((l) => l.amountFils)).toEqual([242397, -100000, -500, -500]);
    expect(r.closingBalanceFils).toBe(199000);
    expect(r.openingBalanceFils).toBe(57603);
    expect(new Set(r.lines.map((l) => l.externalId)).size).toBe(4);
    // Identical lines (same day, amount, text) with different balances stay distinct transactions.
    // Same file parsed again → same ids (so re-import is detected as duplicate).
    expect(parseStatement(recs, map).lines.map((l) => l.externalId)).toEqual(r.lines.map((l) => l.externalId));
  });

  it("reads the Wio Business export: reference ids, N/A cells, notes, Fees type, balance chain", () => {
    const H = ["Account name", "Account type", "Account IBAN", "Account number", "Card number", "Account currency", "Transaction type", "Date", "Ref. number", "Description", "Amount", "Balance", "Original ref. number", "Notes"];
    const row = (v: string[]) => Object.fromEntries(H.map((h, i) => [h, v[i] ?? ""]));
    const base = ["foxstrik - F.Z.E", "Current", "AE00", "95", "N/A", "AED"];
    // Newest first on purpose: the parser must restore chronological order.
    const recs = [
      row([...base, "Fees", "2026-09-25", "305588911", "Subscription fee for Sep 2026", "-99.00", "482.00", "N/A", "Essential"]),
      row([...base, "Transfers", "2026-09-11", "299445357", "To Mert Sadek", "-581.00", "0.00", "N/A", "Transfer money to the my account"]),
      row([...base, "Transfers", "2026-09-05", "296889750", "From ZIINA PAYMENT LLC  CLIENT MONEY", "581.00", "581.00", "N/A", "Cash out transfer for operation 6f37"]),
    ];
    const map = guessColumns(H);
    expect(map).toEqual({
      date: "Date", description: "Description", amount: "Amount", balance: "Balance",
      reference: "Ref. number", notes: "Notes", type: "Transaction type",
    });
    const r = parseStatement(recs, map);
    expect(r.lines.map((l) => l.date.slice(0, 10))).toEqual(["2026-09-05", "2026-09-11", "2026-09-25"]);
    expect(r.lines.map((l) => l.externalId)).toEqual(["bank:ref:296889750", "bank:ref:299445357", "bank:ref:305588911"]);
    expect(r.openingBalanceFils).toBe(0);
    expect(r.closingBalanceFils).toBe(48200);
    // 0 → 581 → 0 → −99 ≠ 482: a missing line between 11 and 25 Sep is reported.
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]).toContain("2026-09-25");
    expect(lineText(r.lines[0])).toBe("From ZIINA PAYMENT LLC  CLIENT MONEY — Cash out transfer for operation 6f37");
    const ctx = { bankAccountId: "w", gatewayAccountId: "z", partners: [{ id: "m", name: "Mert Sadek" }] };
    expect(r.lines.map((l) => suggestBooking(l, ctx).kind)).toEqual(["transfer", "transfer", "bank_fee"]);
    expect(suggestBooking({ ...r.lines[2], description: "Wio plan" }, ctx).kind).toBe("bank_fee"); // via type "Fees"
  });

  it("suggests bookings: Ziina payout, partner transfer both ways, fee, ads, other", () => {
    const ctx = { bankAccountId: "w", gatewayAccountId: "z", partners: [{ id: "m", name: "Mert Sadek" }, { id: "n", name: "Nawras Tutunji" }] };
    const line = (description: string, amountFils: number) => ({ date: "2026-09-25T00:00:00+04:00", description, amountFils, externalId: "x" });
    expect(suggestBooking(line("ZIINA FZ LLC", 100), ctx)).toEqual({ kind: "transfer", fromAccountId: "z", toAccountId: "w" });
    expect(suggestBooking(line("Transfer to NAWRAS TUTUNJI", -100), ctx)).toEqual({ kind: "transfer", fromAccountId: "w", toAccountId: "n" });
    expect(suggestBooking(line("From Mert Sadek", 100), ctx)).toEqual({ kind: "transfer", fromAccountId: "m", toAccountId: "w" });
    expect(suggestBooking(line("Monthly account fee", -100), ctx)).toEqual({ kind: "bank_fee", fromAccountId: "w" });
    expect(suggestBooking(line("FACEBK *ADS META", -100), ctx)).toMatchObject({ kind: "expense", category: "ads" });
    expect(suggestBooking(line("OPENAI *CHATGPT", -100), ctx)).toMatchObject({ kind: "expense", category: "subscriptions" });
    expect(suggestBooking(line("Random shop", -100), ctx)).toMatchObject({ kind: "expense", category: "other" });
    expect(suggestBooking(line("Client transfer", 100), ctx)).toEqual({ kind: "income", toAccountId: "w" });
    // A partner-name token must match a whole word ("Mertz" is not Mert).
    expect(suggestBooking(line("Mertz Trading", -100), ctx)).toMatchObject({ kind: "expense" });
  });
});
