import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { ZIINA_STATUS_LABEL, ZOHO_STATUS_LABEL } from "@/lib/status";
import { Badge, Card, ziinaTone, zohoTone } from "@/components/ui";
import { PaymentActions } from "./PaymentActions";
import { MatchPanel } from "./MatchPanel";
import type { Candidate } from "@/lib/reconcile-match";

export const dynamic = "force-dynamic";

const fmt = (d: Date | null) =>
  d ? d.toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "medium", timeStyle: "short" }) : "—";

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.payment.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!p) notFound();

  const rows: [string, React.ReactNode][] = [
    ["المبلغ", <span className="num font-semibold">{formatMoney(p.amountFils, p.currency)}</span>],
    ["الإكرامية", <span className="num">{formatMoney(p.tipFils, p.currency)}</span>],
    ["رسوم Ziina", <span className="num">{formatMoney(p.feeFils, p.currency)}</span>],
    ["الصافي", p.settledFils != null ? <span className="num">{formatMoney(p.settledFils, p.currency)}</span> : "—"],
    ["الوصف", p.message ?? "—"],
    ["تاريخ الإنشاء", <span className="num">{fmt(p.createdAt)}</span>],
    ["تاريخ الدفع", <span className="num">{fmt(p.paidAt)}</span>],
    ["البطاقة", p.cardBrand ? <span className="num">{`${p.cardBrand} •••• ${p.cardLast4 ?? ""}`}</span> : "—"],
    ["Ziina ID", <span className="num text-xs">{p.ziinaIntentId}</span>],
    ["المصدر", p.source === "csv" ? "استيراد CSV" : p.source === "webhook" ? "Webhook (من خارج التطبيق)" : "التطبيق"],
  ];
  const zohoRows: [string, React.ReactNode][] = [
    ["العميل في Zoho", <span className="num">{p.zohoContactId ?? "—"}</span>],
    ["الخدمة", p.zohoItemName ?? p.zohoItemId ?? "—"],
    ["رقم الفاتورة", <span className="num">{p.zohoInvoiceNumber ?? "—"}</span>],
    ["رقم الدفعة", <span className="num">{p.zohoPaymentId ?? "—"}</span>],
    ["إيميل مُرسل", p.emailSent ? "نعم" : "لا"],
    ["آخر ترحيل", <span className="num">{fmt(p.syncedAt)}</span>],
    ["آخر تحقق مع Zoho", <span className="num">{fmt(p.zohoCheckedAt)}</span>],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/payments" className="text-sm text-gray-500 hover:text-gray-800">
          → الدفعات
        </Link>
        <h1 className="text-xl font-bold">{p.customerName || "دفعة بدون اسم"}</h1>
        <Badge tone={ziinaTone(p.status)}>{ZIINA_STATUS_LABEL[p.status] ?? p.status}</Badge>
        <Badge tone={zohoTone(p.zohoStatus)}>{ZOHO_STATUS_LABEL[p.zohoStatus] ?? p.zohoStatus}</Badge>
        {p.test && <Badge tone="yellow">تجريبي</Badge>}
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <h2 className="mb-3 font-semibold">تفاصيل Ziina</h2>
            <dl className="space-y-2 text-sm">
              {rows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-left">{v}</dd>
                </div>
              ))}
            </dl>
            {p.redirectUrl && p.status !== "completed" && (
              <div className="num mt-3 break-all rounded-lg bg-gray-50 p-2 text-left text-xs">{p.redirectUrl}</div>
            )}
          </Card>
          <Card>
            <h2 className="mb-3 font-semibold">Zoho Books</h2>
            <dl className="space-y-2 text-sm">
              {zohoRows.map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="text-left">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-3">
          {p.zohoCandidates && p.zohoStatus !== "paid" && (
            <MatchPanel paymentId={p.id} candidates={JSON.parse(p.zohoCandidates) as Candidate[]} />
          )}
          <PaymentActions
            payment={{
              id: p.id,
              status: p.status,
              zohoStatus: p.zohoStatus,
              customerName: p.customerName ?? "",
              customerEmail: p.customerEmail ?? "",
              customerPhone: p.customerPhone ?? "",
              zohoItemId: p.zohoItemId ?? "",
              zohoItemName: p.zohoItemName ?? "",
              emailSent: p.emailSent,
              lastError: p.lastError,
              paidDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(p.paidAt ?? p.createdAt),
              source: p.source,
            }}
          />
          <Card>
            <h2 className="mb-3 font-semibold">سجل العمليات</h2>
            {p.logs.length === 0 ? (
              <div className="text-sm text-gray-400">لا يوجد سجل بعد</div>
            ) : (
              <ul className="space-y-2 text-sm">
                {p.logs.map((l) => (
                  <li key={l.id} className="flex gap-3 border-b border-gray-100 pb-2 last:border-0">
                    <span className={l.success ? "text-green-600" : "text-red-600"}>{l.success ? "✓" : "✗"}</span>
                    <span className="w-16 shrink-0 text-gray-500">{l.step}</span>
                    <span className="min-w-0 flex-1 break-words">{l.detail}</span>
                    <span className="num shrink-0 text-xs text-gray-400">{fmt(l.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
