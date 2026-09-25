import { prisma } from "./db";
import { accountBalance, partnerStatements, periodReport, type SaleLite } from "./ledger-calc";

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
    },
  });
  return rows.map((r) => ({
    date: r.paidAt ?? r.createdAt,
    grossFils: r.amountFils + r.tipFils - r.amountRefundedFils,
    feeFils: r.feeFils,
    partnerAccountId: r.partnerAccountId,
    gateway: r.gateway,
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
  return { report, balances, statements };
}
