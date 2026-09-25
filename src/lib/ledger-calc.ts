// Pure accounting maths for the simple ledger. No I/O — fully unit-tested.
//
// Money model (all AED base units):
//   • Ziina sales come from completed payments (gross, Ziina fee) — never entered twice.
//   • transfer  : money moves between two accounts (Ziina → Wio, Wio → partner, partner → Wio).
//   • expense   : money leaves an account for a business cost (category).
//   • bank_fee  : bank/transfer charges leaving an account.
//   • income    : other money coming into an account (not through Ziina).
// A partner "fund" balance = what the partner has taken out of the company, net of what they paid in
// or spent on the company's behalf.

export type AccountKind = "gateway" | "bank" | "partner";
export type EntryKind = "transfer" | "expense" | "bank_fee" | "income";

export interface AccountLite {
  id: string;
  key?: string | null;
  name: string;
  kind: string;
  openingFils: number;
  openingDate?: Date | null;
}

export interface EntryLite {
  date: Date;
  kind: string;
  amountFils: number;
  feeFils: number;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  category?: string | null;
}

export interface SaleLite {
  date: Date; // paid date
  grossFils: number; // amount + tip, AED
  feeFils: number; // Ziina fee, AED
  partnerAccountId?: string | null; // partner entitled to this payment
}

export const EXPENSE_CATEGORIES = [
  { key: "ads", ar: "إعلانات وتسويق", en: "Ads & marketing" },
  { key: "subscriptions", ar: "اشتراكات وبرامج", en: "Subscriptions & software" },
  { key: "services", ar: "خدمات ومستقلون", en: "Services & freelancers" },
  { key: "salaries", ar: "رواتب", en: "Salaries" },
  { key: "office", ar: "مكتب وتشغيل", en: "Office & operations" },
  { key: "government", ar: "رسوم حكومية وتراخيص", en: "Government & licences" },
  { key: "refunds", ar: "مبالغ مستردة للعملاء", en: "Customer refunds" },
  { key: "other", ar: "مصاريف أخرى", en: "Other expenses" },
] as const;

const inRange = (d: Date, from?: Date | null, to?: Date | null) =>
  (!from || d >= from) && (!to || d <= to);

/** Money flowing into / out of an account for one entry (0 if the entry does not touch it). */
export function entryEffect(e: EntryLite, accountId: string): number {
  let v = 0;
  if (e.toAccountId === accountId && (e.kind === "transfer" || e.kind === "income")) v += e.amountFils;
  if (e.fromAccountId === accountId) {
    if (e.kind === "transfer") v -= e.amountFils + e.feeFils;
    if (e.kind === "expense" || e.kind === "bank_fee") v -= e.amountFils;
  }
  return v;
}

/**
 * Balance of an account at `asOf` (inclusive). Movements before the account's opening date are
 * already included in its opening balance and are ignored. The gateway account keyed "ziina"
 * also receives the net of every Ziina sale.
 */
export function accountBalance(account: AccountLite, entries: EntryLite[], sales: SaleLite[], asOf?: Date): number {
  const from = account.openingDate ?? null;
  let bal = account.openingFils;
  for (const e of entries) if (inRange(e.date, from, asOf ?? null)) bal += entryEffect(e, account.id);
  if (account.key === "ziina") {
    for (const s of sales) if (inRange(s.date, from, asOf ?? null)) bal += s.grossFils - s.feeFils;
  }
  return bal;
}

export interface PartnerSummary {
  accountId: string;
  name: string;
  received: number; // transferred from the company to the partner
  paidIn: number; // partner put money into the company
  expensesPaid: number; // company expenses the partner paid personally
  net: number; // received − paidIn − expensesPaid
}

export interface PeriodReport {
  salesCount: number;
  sales: number;
  gatewayFees: number;
  netReceived: number;
  otherIncome: number;
  bankFees: number;
  expenses: number;
  expensesByCategory: { category: string; amount: number }[];
  netProfit: number;
  gatewayWithdrawals: number; // gateway → bank transfers
  partners: PartnerSummary[];
  partnersNet: number;
  retained: number; // profit left in the company after partner transfers
}

export function periodReport(
  accounts: AccountLite[],
  entries: EntryLite[],
  sales: SaleLite[],
  from?: Date | null,
  to?: Date | null,
): PeriodReport {
  const kindOf = new Map(accounts.map((a) => [a.id, a.kind]));
  const es = entries.filter((e) => inRange(e.date, from, to));
  const ss = sales.filter((s) => inRange(s.date, from, to));

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const salesTotal = sum(ss.map((s) => s.grossFils));
  const gatewayFees = sum(ss.map((s) => s.feeFils));
  const otherIncome = sum(es.filter((e) => e.kind === "income").map((e) => e.amountFils));
  const bankFees =
    sum(es.filter((e) => e.kind === "bank_fee").map((e) => e.amountFils)) +
    sum(es.filter((e) => e.kind === "transfer").map((e) => e.feeFils));

  const byCat = new Map<string, number>();
  for (const e of es.filter((x) => x.kind === "expense")) {
    const c = e.category || "other";
    byCat.set(c, (byCat.get(c) ?? 0) + e.amountFils);
  }
  const expenses = sum([...byCat.values()]);

  const gatewayWithdrawals = sum(
    es
      .filter((e) => e.kind === "transfer" && kindOf.get(e.fromAccountId ?? "") === "gateway" && kindOf.get(e.toAccountId ?? "") !== "partner")
      .map((e) => e.amountFils),
  );

  const partners: PartnerSummary[] = accounts
    .filter((a) => a.kind === "partner")
    .map((a) => {
      const received = sum(es.filter((e) => e.kind === "transfer" && e.toAccountId === a.id).map((e) => e.amountFils));
      const paidIn = sum(es.filter((e) => e.kind === "transfer" && e.fromAccountId === a.id).map((e) => e.amountFils));
      const expensesPaid = sum(es.filter((e) => e.kind === "expense" && e.fromAccountId === a.id).map((e) => e.amountFils));
      return { accountId: a.id, name: a.name, received, paidIn, expensesPaid, net: received - paidIn - expensesPaid };
    });

  const netProfit = salesTotal + otherIncome - gatewayFees - bankFees - expenses;
  const partnersNet = sum(partners.map((p) => p.net));

  return {
    salesCount: ss.length,
    sales: salesTotal,
    gatewayFees,
    netReceived: salesTotal - gatewayFees,
    otherIncome,
    bankFees,
    expenses,
    expensesByCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    netProfit,
    gatewayWithdrawals,
    partners,
    partnersNet,
    retained: netProfit - partnersNet,
  };
}

/** Basic validation of an entry's accounts for its kind. Returns an error message or null. */
export function validateEntry(
  e: { kind: string; amountFils: number; fromAccountId?: string | null; toAccountId?: string | null; category?: string | null },
): string | null {
  if (!Number.isFinite(e.amountFils) || e.amountFils <= 0) return "amount";
  if (e.kind === "transfer") {
    if (!e.fromAccountId || !e.toAccountId) return "accounts";
    if (e.fromAccountId === e.toAccountId) return "same_account";
  } else if (e.kind === "expense" || e.kind === "bank_fee") {
    if (!e.fromAccountId) return "accounts";
  } else if (e.kind === "income") {
    if (!e.toAccountId) return "accounts";
  } else return "kind";
  return null;
}

// ---------- Partner statements ----------

export interface PartnerStatement {
  accountId: string;
  name: string;
  paymentsCount: number;
  entitledFromPayments: number; // net (gross − Ziina fee) of the payments assigned to the partner
  expensesPaid: number; // company expenses the partner paid personally (owed back to them)
  paidIn: number; // money the partner put into the company (owed back to them)
  costShare: number; // partner's share of shared costs (bank fees + expenses − other income)
  due: number; // entitledFromPayments + expensesPaid + paidIn − costShare
  received: number; // transfers from the company to the partner
  remaining: number; // due − received; negative = received more than due
}

/**
 * Split `total` base units across weights proportionally, exactly (largest-remainder rounding, so
 * the parts always add up to the total). Equal split when all weights are zero.
 */
export function allocate(total: number, weights: number[]): number[] {
  if (!weights.length) return [];
  const w = weights.map((x) => Math.max(0, x));
  const sumW = w.reduce((a, b) => a + b, 0);
  const shares = sumW > 0 ? w.map((x) => (total * x) / sumW) : w.map(() => total / w.length);
  const floors = shares.map((x) => Math.floor(x));
  let rest = total - floors.reduce((a, b) => a + b, 0);
  const order = shares.map((x, i) => ({ i, frac: x - Math.floor(x) })).sort((a, b) => b.frac - a.frac);
  for (let k = 0; rest > 0 && k < order.length; k++, rest--) floors[order[k].i] += 1;
  return floors;
}

/**
 * What each partner should receive vs. what they actually received, up to `to` (inclusive).
 * Cumulative from the beginning: a remaining balance only makes sense over the whole history.
 *
 * Shared costs (bank & transfer fees, all expenses, minus other income) are taken from the base
 * before distribution: each partner bears a share proportional to the net of their payments.
 * With every payment assigned: Σ remaining = net profit + what partners put in (paid in and
 * expenses paid personally) − what they received.
 */
export function partnerStatements(
  accounts: AccountLite[],
  entries: EntryLite[],
  sales: SaleLite[],
  to?: Date | null,
): { partners: PartnerStatement[]; unassigned: { count: number; net: number }; sharedCosts: number } {
  const es = entries.filter((e) => inRange(e.date, null, to));
  const ss = sales.filter((s) => inRange(s.date, null, to));
  const partnerAccounts = accounts.filter((a) => a.kind === "partner");
  const partnerIds = new Set(partnerAccounts.map((a) => a.id));
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const sharedCosts =
    sum(es.filter((e) => e.kind === "bank_fee" || e.kind === "expense").map((e) => e.amountFils)) +
    sum(es.filter((e) => e.kind === "transfer").map((e) => e.feeFils)) -
    sum(es.filter((e) => e.kind === "income").map((e) => e.amountFils));

  const base = partnerAccounts.map((a) => {
    const mine = ss.filter((x) => x.partnerAccountId === a.id);
    return { a, mine, entitledFromPayments: sum(mine.map((x) => x.grossFils - x.feeFils)) };
  });
  const shares = allocate(sharedCosts, base.map((b) => b.entitledFromPayments));

  const partners = base.map(({ a, mine, entitledFromPayments }, i) => {
    const expensesPaid = sum(es.filter((e) => e.kind === "expense" && e.fromAccountId === a.id).map((e) => e.amountFils));
    const paidIn = sum(es.filter((e) => e.kind === "transfer" && e.fromAccountId === a.id).map((e) => e.amountFils));
    const received = sum(es.filter((e) => e.kind === "transfer" && e.toAccountId === a.id).map((e) => e.amountFils));
    const costShare = shares[i];
    const due = entitledFromPayments + expensesPaid + paidIn - costShare;
    return {
      accountId: a.id,
      name: a.name,
      paymentsCount: mine.length,
      entitledFromPayments,
      expensesPaid,
      paidIn,
      costShare,
      due,
      received,
      remaining: due - received,
    };
  });

  const unassignedSales = ss.filter((x) => !x.partnerAccountId || !partnerIds.has(x.partnerAccountId));
  return {
    partners,
    unassigned: { count: unassignedSales.length, net: sum(unassignedSales.map((x) => x.grossFils - x.feeFils)) },
    sharedCosts,
  };
}
