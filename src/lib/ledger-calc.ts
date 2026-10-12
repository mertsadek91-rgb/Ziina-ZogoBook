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

// cash = a company cash box / holding account (e.g. "صندوق التجميع"): money passes through it,
// it is NOT a partner and never appears in partner statements.
export type AccountKind = "gateway" | "bank" | "cash" | "partner";
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
  // optional details, used for account statements
  id?: string;
  description?: string | null;
  reference?: string | null;
}

export interface SaleLite {
  date: Date; // paid date
  grossFils: number; // amount + tip, AED
  feeFils: number; // Ziina fee, AED
  partnerAccountId?: string | null; // partner entitled to this payment
  gateway?: string; // "ziina" (default) | "stripe" — the gateway account keyed the same receives it
  // optional details, used for account statements
  paymentId?: string;
  orderNumber?: string | null;
  customerName?: string | null;
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
  if (account.kind === "gateway" && account.key) {
    for (const s of sales) {
      if ((s.gateway ?? "ziina") === account.key && inRange(s.date, from, asOf ?? null)) bal += s.grossFils - s.feeFils;
    }
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
  salesByGateway: { gateway: string; count: number; sales: number; fees: number }[];
  sales: number;
  gatewayFees: number;
  netReceived: number;
  otherIncome: number;
  bankFees: number;
  expenses: number;
  expensesByCategory: { category: string; amount: number }[];
  netProfit: number;
  gatewayWithdrawals: number; // gateway → bank transfers
  withdrawalsByGateway: { accountId: string; name: string; amount: number }[]; // per gateway account
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
    salesByGateway: [...new Set(ss.map((s) => s.gateway ?? "ziina"))].sort().map((g) => {
      const x = ss.filter((s) => (s.gateway ?? "ziina") === g);
      return { gateway: g, count: x.length, sales: sum(x.map((s) => s.grossFils)), fees: sum(x.map((s) => s.feeFils)) };
    }),
    sales: salesTotal,
    gatewayFees,
    netReceived: salesTotal - gatewayFees,
    otherIncome,
    bankFees,
    expenses,
    expensesByCategory: [...byCat.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    netProfit,
    gatewayWithdrawals,
    withdrawalsByGateway: accounts
      .filter((a) => a.kind === "gateway")
      .map((a) => ({
        accountId: a.id,
        name: a.name,
        amount: sum(
          es
            .filter((e) => e.kind === "transfer" && e.fromAccountId === a.id && kindOf.get(e.toAccountId ?? "") !== "partner")
            .map((e) => e.amountFils),
        ),
      })),
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

// ---------- Bank box & partner money reconciliation ----------

export interface FlowLine {
  direction: "in" | "out";
  kind: "transfer" | "income" | "expense" | "bank_fee" | "transfer_fee" | "sales";
  counterpartId?: string; // other account of a transfer
  amount: number; // always positive
}

export interface AccountFlows {
  accountId: string;
  opening: number;
  lines: FlowLine[]; // grouped: one line per (direction, kind, counterpart)
  totalIn: number;
  totalOut: number;
  balance: number; // opening + in − out (= accountBalance)
}

/**
 * Where an account's money came from and where it went, up to `to` (same rules as accountBalance:
 * movements before the opening date are part of the opening balance). Transfers are grouped by the
 * other account, so a bank box reads "from Ziina +X, from Stripe +Y, to Mert −Z, …".
 */
export function accountFlows(account: AccountLite, entries: EntryLite[], sales: SaleLite[], to?: Date | null): AccountFlows {
  const from = account.openingDate ?? null;
  const map = new Map<string, FlowLine>();
  const add = (line: Omit<FlowLine, "amount">, amount: number) => {
    if (!amount) return;
    const k = `${line.direction}|${line.kind}|${line.counterpartId ?? ""}`;
    const cur = map.get(k);
    if (cur) cur.amount += amount;
    else map.set(k, { ...line, amount });
  };
  for (const e of entries) {
    if (!inRange(e.date, from, to)) continue;
    if (e.toAccountId === account.id && e.kind === "transfer") add({ direction: "in", kind: "transfer", counterpartId: e.fromAccountId ?? undefined }, e.amountFils);
    if (e.toAccountId === account.id && e.kind === "income") add({ direction: "in", kind: "income" }, e.amountFils);
    if (e.fromAccountId === account.id) {
      if (e.kind === "transfer") {
        add({ direction: "out", kind: "transfer", counterpartId: e.toAccountId ?? undefined }, e.amountFils);
        add({ direction: "out", kind: "transfer_fee" }, e.feeFils);
      }
      if (e.kind === "expense") add({ direction: "out", kind: "expense" }, e.amountFils);
      if (e.kind === "bank_fee") add({ direction: "out", kind: "bank_fee" }, e.amountFils);
    }
  }
  if (account.kind === "gateway" && account.key) {
    const net = sales
      .filter((s) => (s.gateway ?? "ziina") === account.key && inRange(s.date, from, to))
      .reduce((a, s) => a + s.grossFils - s.feeFils, 0);
    add({ direction: "in", kind: "sales" }, net);
  }
  const lines = [...map.values()].sort((a, b) => (a.direction === b.direction ? b.amount - a.amount : a.direction === "in" ? -1 : 1));
  const totalIn = lines.filter((l) => l.direction === "in").reduce((a, l) => a + l.amount, 0);
  const totalOut = lines.filter((l) => l.direction === "out").reduce((a, l) => a + l.amount, 0);
  return { accountId: account.id, opening: account.openingFils, lines, totalIn, totalOut, balance: account.openingFils + totalIn - totalOut };
}

export interface MoneyReconciliation {
  owedToPartners: number; // Σ partner "remaining"
  held: { accountId: string; name: string; kind: string; balance: number }[]; // banks, cash boxes, gateways
  heldTotal: number;
  difference: number; // heldTotal − owedToPartners
  openingTotal: number; // explains part of the difference
  unassignedNet: number; // payments without a partner (explains the rest)
}

/**
 * Every dirham the company holds (banks, cash boxes, gateway balances) should be owed to a partner.
 * heldTotal − owedToPartners = opening balances + net of payments not yet assigned to a partner.
 */
export function moneyReconciliation(accounts: AccountLite[], entries: EntryLite[], sales: SaleLite[], to?: Date | null): MoneyReconciliation {
  const st = partnerStatements(accounts, entries, sales, to);
  const owedToPartners = st.partners.reduce((a, p) => a + p.remaining, 0);
  const held = accounts
    .filter((a) => a.kind !== "partner")
    .map((a) => ({ accountId: a.id, name: a.name, kind: a.kind, balance: accountBalance(a, entries, sales, to ?? undefined) }));
  const heldTotal = held.reduce((a, h) => a + h.balance, 0);
  return {
    owedToPartners,
    held,
    heldTotal,
    difference: heldTotal - owedToPartners,
    openingTotal: accounts.filter((a) => a.kind !== "partner").reduce((a, x) => a + x.openingFils, 0),
    unassignedNet: st.unassigned.net,
  };
}

// ---------- Account statements (كشف حساب) ----------

export type StatementLineType =
  | "sale" // gateway: net of a payment received / partner: net of a payment assigned to them
  | "transfer_in"
  | "transfer_out"
  | "transfer_fee"
  | "income"
  | "expense"
  | "expense_paid" // partner paid a company expense personally (owed back to them)
  | "bank_fee"
  | "cost_share"; // partner's share of a shared cost (or of other income, as a credit)

export interface StatementLine {
  date: Date;
  type: StatementLineType;
  in: number; // money in / amount owed to the partner increases
  out: number; // money out / amount owed to the partner decreases
  counterpartId?: string;
  description?: string | null;
  reference?: string | null;
  category?: string | null;
  // sales
  paymentId?: string;
  orderNumber?: string | null;
  customerName?: string | null;
  gateway?: string;
  gross?: number;
  fee?: number;
  balance?: number; // running balance after this line (set for rows in the period)
}

export interface AccountStatement {
  accountId: string;
  opening: number; // balance at the start of the period
  rows: StatementLine[];
  totalIn: number;
  totalOut: number;
  closing: number;
}

/**
 * Full account statement with a running balance. For banks, cash boxes and gateways the balance is
 * the money in the account; for partners it is what the company owes them ("remaining") — the
 * closing balance equals the partner card / account balance at the same date.
 */
export function accountStatement(
  account: AccountLite,
  accounts: AccountLite[],
  entries: EntryLite[],
  sales: SaleLite[],
  from?: Date | null,
  to?: Date | null,
): AccountStatement {
  const lines: StatementLine[] = [];
  const meta = (e: EntryLite) => ({ description: e.description, reference: e.reference, category: e.category });
  const saleLine = (s: SaleLite): StatementLine => ({
    date: s.date,
    type: "sale",
    in: s.grossFils - s.feeFils,
    out: 0,
    paymentId: s.paymentId,
    orderNumber: s.orderNumber,
    customerName: s.customerName,
    gateway: s.gateway ?? "ziina",
    gross: s.grossFils,
    fee: s.feeFils,
  });

  if (account.kind === "partner") {
    const es = entries.filter((e) => inRange(e.date, null, to));
    for (const s of sales) if (s.partnerAccountId === account.id && inRange(s.date, null, to)) lines.push(saleLine(s));
    for (const e of es) {
      if (e.kind === "transfer" && e.fromAccountId === account.id)
        lines.push({ date: e.date, type: "transfer_out", in: e.amountFils, out: 0, counterpartId: e.toAccountId ?? undefined, ...meta(e) });
      if (e.kind === "transfer" && e.toAccountId === account.id)
        lines.push({ date: e.date, type: "transfer_in", in: 0, out: e.amountFils, counterpartId: e.fromAccountId ?? undefined, ...meta(e) });
      if (e.kind === "expense" && e.fromAccountId === account.id)
        lines.push({ date: e.date, type: "expense_paid", in: e.amountFils, out: 0, ...meta(e) });
    }
    // Share of each shared cost, with the same weights as the partner card; the last line absorbs
    // rounding so the total equals the card's cost share exactly.
    const st = partnerStatements(accounts, entries, sales, to);
    const partners = st.partners;
    const me = partners.findIndex((p) => p.accountId === account.id);
    const weights = partners.map((p) => p.entitledFromPayments);
    const costs: { e: EntryLite; amount: number }[] = [];
    for (const e of es) {
      if (e.kind === "bank_fee" || e.kind === "expense") costs.push({ e, amount: e.amountFils });
      if (e.kind === "transfer" && e.feeFils) costs.push({ e, amount: e.feeFils });
      if (e.kind === "income") costs.push({ e, amount: -e.amountFils });
    }
    if (me >= 0 && costs.length) {
      const shares = costs.map((c) => allocate(c.amount, weights)[me]);
      const target = partners[me].costShare;
      shares[shares.length - 1] += target - shares.reduce((a, b) => a + b, 0);
      costs.forEach((c, i) => {
        const v = shares[i];
        if (!v) return;
        lines.push({ date: c.e.date, type: "cost_share", in: v < 0 ? -v : 0, out: v > 0 ? v : 0, ...meta(c.e), category: c.e.kind === "expense" ? c.e.category : c.e.kind });
      });
    }
  } else {
    const start = account.openingDate ?? null;
    for (const e of entries) {
      if (!inRange(e.date, start, to)) continue;
      if (e.toAccountId === account.id && e.kind === "transfer")
        lines.push({ date: e.date, type: "transfer_in", in: e.amountFils, out: 0, counterpartId: e.fromAccountId ?? undefined, ...meta(e) });
      if (e.toAccountId === account.id && e.kind === "income") lines.push({ date: e.date, type: "income", in: e.amountFils, out: 0, ...meta(e) });
      if (e.fromAccountId === account.id) {
        if (e.kind === "transfer") {
          lines.push({ date: e.date, type: "transfer_out", in: 0, out: e.amountFils, counterpartId: e.toAccountId ?? undefined, ...meta(e) });
          if (e.feeFils) lines.push({ date: e.date, type: "transfer_fee", in: 0, out: e.feeFils, ...meta(e) });
        }
        if (e.kind === "expense") lines.push({ date: e.date, type: "expense", in: 0, out: e.amountFils, ...meta(e) });
        if (e.kind === "bank_fee") lines.push({ date: e.date, type: "bank_fee", in: 0, out: e.amountFils, ...meta(e) });
      }
    }
    if (account.kind === "gateway" && account.key) {
      for (const s of sales) if ((s.gateway ?? "ziina") === account.key && inRange(s.date, start, to)) lines.push(saleLine(s));
    }
  }

  lines.sort((a, b) => a.date.getTime() - b.date.getTime());
  let opening = account.kind === "partner" ? 0 : account.openingFils;
  const rows: StatementLine[] = [];
  for (const l of lines) {
    if (from && l.date < from) opening += l.in - l.out;
    else rows.push(l);
  }
  let bal = opening;
  for (const r of rows) {
    bal += r.in - r.out;
    r.balance = bal;
  }
  const totalIn = rows.reduce((a, r) => a + r.in, 0);
  const totalOut = rows.reduce((a, r) => a + r.out, 0);
  return { accountId: account.id, opening, rows, totalIn, totalOut, closing: opening + totalIn - totalOut };
}
