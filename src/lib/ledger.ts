import { prisma } from "./db";
import {
  accountBalance,
  accountFlows,
  accountStatement,
  moneyReconciliation,
  partnerStatements,
  periodReport,
  type SaleLite,
} from "./ledger-calc";

/** Accounts every installation starts with. Created on first use; names can be edited later. */
const DEFAULT_ACCOUNTS = [
  { key: "ziina", name: "Ziina", kind: "gateway", sortOrder: 1 },
  { key: "wio", name: "Wio Bank", kind: "bank", sortOrder: 2 },
  { key: "partner_mert", name: "Mert Sadek", kind: "partner", sortOrder: 3 },
  { key: "partner_nawras", name: "Nawras Tutunji", kind: "partner", sortOrder: 4 },
  { key: "stripe", name: "Stripe", kind: "gateway", sortOrder: 2 },
];

export async function ensureDefaultAccounts() {
  const existing = await prisma.ledgerAccount.findMany({ where: { key: { in: DEFAULT_ACCOUNTS.map((a) => a.key) } } });
  const have = new Set(existing.map((a) => a.key));
  const missing = DEFAULT_ACCOUNTS.filter((a) => !have.has(a.key));
  if (missing.length) {
    // skipDuplicates guards against two requests creating them at the same time.
    await prisma.ledgerAccount.createMany({ data: missing, skipDuplicates: true });
  }
}

export async function listAccounts() {
  await ensureDefaultAccounts();
  return prisma.ledgerAccount.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

/** Ziina sales that count as company revenue: completed, settled in AED, not test, not hidden. */
async function loadSales(): Promise<SaleLite[]> {
  const rows = await prisma.payment.findMany({
    where: { status: "completed", currency: "AED", test: false, archived: false },
    select: {
      paidAt: true,
      createdAt: true,
      amountFils: true,
      tipFils: true,
      feeFils: true,
      amountRefundedFils: true,
      partnerAccountId: true,
      gateway: true,
      id: true,
      orderNumber: true,
      customerName: true,
    },
  });
  return rows.map((r) => ({
    date: r.paidAt ?? r.createdAt,
    grossFils: r.amountFils + r.tipFils - r.amountRefundedFils,
    feeFils: r.feeFils,
    partnerAccountId: r.partnerAccountId,
    gateway: r.gateway,
    paymentId: r.id,
    orderNumber: r.orderNumber,
    customerName: r.customerName,
  }));
}

export async function accountingSummary(from?: Date | null, to?: Date | null) {
  const accounts = await listAccounts();
  const [entries, sales] = await Promise.all([
    prisma.ledgerEntry.findMany({
      select: { date: true, kind: true, amountFils: true, feeFils: true, fromAccountId: true, toAccountId: true, category: true },
    }),
    loadSales(),
  ]);
  const report = periodReport(accounts, entries, sales, from, to);
  // Balances are "as of" the end of the selected period (or now).
  const balances = accounts.map((a) => ({
    id: a.id,
    key: a.key,
    name: a.name,
    kind: a.kind,
    balance: accountBalance(a, entries, sales, to ?? undefined),
    statementBalanceFils: a.statementBalanceFils,
    statementDate: a.statementDate?.toISOString() ?? null,
  }));
  const statements = partnerStatements(accounts, entries, sales, to);
  // Bank and cash-box breakdown (cumulative, like the balances) + who the held money belongs to.
  // Boxes: banks, cash boxes, and any account added by hand (e.g. a collection box still typed as partner).
  const flows = accounts
    .filter((a) => a.kind === "bank" || a.kind === "cash" || (!a.key && a.kind !== "gateway"))
    .map((a) => accountFlows(a, entries, sales, to));
  const reconciliation = moneyReconciliation(accounts, entries, sales, to);
  return { report, balances, statements, flows, reconciliation };
}

const ENTRY_FIELDS = {
  id: true,
  date: true,
  kind: true,
  amountFils: true,
  feeFils: true,
  fromAccountId: true,
  toAccountId: true,
  category: true,
  description: true,
  reference: true,
} as const;

/** Account statement (كشف حساب) for one account over a period, with running balance. */
export async function accountingStatement(accountId: string, from?: Date | null, to?: Date | null) {
  const accounts = await listAccounts();
  const account = accounts.find((a) => a.id === accountId);
  if (!account) throw new Error("الحساب غير موجود");
  const [entries, sales] = await Promise.all([prisma.ledgerEntry.findMany({ select: ENTRY_FIELDS }), loadSales()]);
  const st = accountStatement(account, accounts, entries, sales, from, to);
  return {
    account: { id: account.id, name: account.name, kind: account.kind, key: account.key },
    accounts: accounts.map((a) => ({ id: a.id, name: a.name, kind: a.kind })),
    ...st,
  };
}
