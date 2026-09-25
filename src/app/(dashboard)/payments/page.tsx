import { prisma } from "@/lib/db";
import { TABS, tabOf, whereForTab, type Tab } from "@/lib/status";
import { PaymentsView } from "./PaymentsView";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : "to_invoice") as Tab;
  const q = sp.q?.trim() || "";

  const groups = await prisma.payment.groupBy({
    by: ["status", "zohoStatus", "zohoCandidateCount", "archived", "currency"],
    _count: { _all: true },
    _sum: { amountFils: true },
  });

  const counts: Record<string, { n: number; sum: number }> = { all: { n: 0, sum: 0 } };
  for (const g of groups) {
    const t = tabOf(g);
    counts[t] ??= { n: 0, sum: 0 };
    counts[t].n += g._count._all;
    const aed = g.currency === "AED" ? (g._sum.amountFils ?? 0) : 0;
    counts[t].sum += aed;
    if (g.archived) continue;
    counts.all.n += g._count._all;
    counts.all.sum += aed;
  }

  const visibleTestCount = await prisma.payment.count({ where: { test: true, archived: false } });

  const dateFilter =
    sp.from || sp.to
      ? {
          createdAt: {
            // Whole calendar days in Dubai time.
            ...(sp.from ? { gte: new Date(`${sp.from}T00:00:00+04:00`) } : {}),
            ...(sp.to ? { lte: new Date(`${sp.to}T23:59:59.999+04:00`) } : {}),
          },
        }
      : {};
  const amountQ = q && /^\d+(\.\d+)?$/.test(q) ? Math.round(Number(q) * 100) : null;
  const searchFilter = q
    ? {
        OR: [
          { customerName: { contains: q } },
          { orderNumber: { contains: q.replace(/^#/, "") } },
          { customerEmail: { contains: q } },
          { customerPhone: { contains: q } },
          { message: { contains: q } },
          { ziinaIntentId: { contains: q } },
          { zohoInvoiceNumber: { contains: q } },
          ...(amountQ !== null ? [{ amountFils: amountQ }] : []),
        ],
      }
    : {};

  const payments = await prisma.payment.findMany({
    where: { AND: [whereForTab(tab), dateFilter, searchFilter] },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  const serializedPayments = payments.map((p) => ({
    id: p.id,
    ziinaIntentId: p.ziinaIntentId,
    amountFils: p.amountFils + p.tipFils,
    currency: p.currency,
    originalAmountFils: p.originalAmountFils,
    originalCurrency: p.originalCurrency,
    status: p.status,
    zohoStatus: p.zohoStatus,
    customerName: p.customerName,
    customerEmail: p.customerEmail,
    orderNumber: p.orderNumber,
    message: p.message,
    zohoInvoiceNumber: p.zohoInvoiceNumber,
    redirectUrl: p.redirectUrl,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    test: p.test,
    lastError: p.lastError,
    source: p.source,
    candidateCount: p.zohoCandidateCount,
    checkedAt: p.zohoCheckedAt?.toISOString() ?? null,
  }));

  return (
    <PaymentsView
      initialTab={tab}
      initialQ={q}
      initialFrom={sp.from || ""}
      initialTo={sp.to || ""}
      counts={counts}
      visibleTestCount={visibleTestCount}
      payments={serializedPayments}
    />
  );
}
