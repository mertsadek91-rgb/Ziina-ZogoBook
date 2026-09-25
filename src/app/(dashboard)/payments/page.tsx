import Link from "next/link";
import { prisma } from "@/lib/db";
import { TABS, tabOf, whereForTab, type Tab } from "@/lib/status";
import { formatMoney } from "@/lib/money";
import { PaymentsTable } from "./PaymentsTable";
import { ReconcileButton } from "./ReconcileButton";
import { HideTestButton } from "./HideTestButton";

export const dynamic = "force-dynamic";

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; from?: string; to?: string }>;
}) {
  const sp = await searchParams;
  const tab = (TABS.some((t) => t.key === sp.tab) ? sp.tab : "to_invoice") as Tab;
  const q = sp.q?.trim();

  const groups = await prisma.payment.groupBy({
    by: ["status", "zohoStatus", "zohoCandidateCount", "archived"],
    _count: { _all: true },
    _sum: { amountFils: true },
  });
  const counts: Record<string, { n: number; sum: number }> = { all: { n: 0, sum: 0 } };
  for (const g of groups) {
    const t = tabOf(g);
    counts[t] ??= { n: 0, sum: 0 };
    counts[t].n += g._count._all;
    counts[t].sum += g._sum.amountFils ?? 0;
    if (g.archived) continue;
    counts.all.n += g._count._all;
    counts.all.sum += g._sum.amountFils ?? 0;
  }

  const visibleTestCount = await prisma.payment.count({ where: { test: true, archived: false } });

  const dateFilter =
    sp.from || sp.to
      ? {
          createdAt: {
            ...(sp.from ? { gte: new Date(sp.from) } : {}),
            ...(sp.to ? { lte: new Date(sp.to + "T23:59:59") } : {}),
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

  const qs = (t: string) => {
    const p = new URLSearchParams();
    p.set("tab", t);
    if (q) p.set("q", q);
    if (sp.from) p.set("from", sp.from);
    if (sp.to) p.set("to", sp.to);
    return `/payments?${p}`;
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold">الدفعات</h1>
        <div className="flex flex-wrap gap-2">
          {visibleTestCount > 0 && <HideTestButton count={visibleTestCount} />}
          <ReconcileButton />
          <Link href="/quick-link" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">
            رابط سريع
          </Link>
          <Link href="/links/new" className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark">
            + رابط دفع جديد
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        {TABS.map((t) => {
          const c = counts[t.key] ?? { n: 0, sum: 0 };
          const active = t.key === tab;
          return (
            <Link
              key={t.key}
              href={qs(t.key)}
              className={`rounded-xl border p-3 transition ${active ? "border-brand bg-brand/5 ring-2 ring-brand/20" : "border-gray-200 bg-white hover:border-gray-300"}`}
            >
              <div className="text-xs text-gray-500">{t.label}</div>
              <div className="num mt-1 text-lg font-bold">{c.n}</div>
              <div className="num text-xs text-gray-500">{formatMoney(c.sum)}</div>
            </Link>
          );
        })}
      </div>

      <form className="flex flex-wrap items-end gap-2" action="/payments">
        <input type="hidden" name="tab" value={tab} />
        <div className="min-w-56 flex-1">
          <label>بحث</label>
          <input name="q" defaultValue={q} placeholder="اسم، إيميل، هاتف، مبلغ، رقم طلب أو فاتورة..." />
        </div>
        <div>
          <label>من</label>
          <input type="date" name="from" defaultValue={sp.from} />
        </div>
        <div>
          <label>إلى</label>
          <input type="date" name="to" defaultValue={sp.to} />
        </div>
        <button className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50">تطبيق</button>
      </form>

      <PaymentsTable
        tab={tab}
        payments={payments.map((p) => ({
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
        }))}
      />
    </div>
  );
}
