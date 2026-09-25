"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText, Inbox } from "lucide-react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { api } from "@/components/fetcher";
import { useI18n } from "@/lib/i18n";
import { formatMoney } from "@/lib/money";

interface Invoice {
  id: string;
  number: string | null;
  status: string | null;
  currency: string;
  total: number;
  amountPaid: number;
  amountRemaining: number;
  created: number;
  dueDate: number | null;
  customerName: string | null;
  customerEmail: string | null;
  hostedUrl: string | null;
  pdf: string | null;
  description: string | null;
  livemode: boolean;
  paymentId: string | null;
  zohoInvoiceNumber: string | null;
}

const STATUS_TONE: Record<string, "green" | "yellow" | "gray" | "red" | "blue"> = {
  paid: "green",
  open: "yellow",
  draft: "gray",
  uncollectible: "red",
  void: "gray",
};

const L = {
  ar: {
    title: "فواتير Stripe",
    subtitle: "تُقرأ مباشرة من حساب Stripe (قراءة فقط). الفواتير المدفوعة مرتبطة بدفعاتها في النظام.",
    all: "كل الحالات",
    status: { paid: "مدفوعة", open: "مفتوحة", draft: "مسودة", uncollectible: "غير قابلة للتحصيل", void: "ملغاة" } as Record<string, string>,
    number: "الرقم",
    customer: "العميل",
    date: "التاريخ",
    total: "الإجمالي",
    remaining: "المتبقي",
    payment: "الدفعة",
    open_payment: "فتح الدفعة",
    no_payment: "غير مرتبطة",
    none: "لا توجد فواتير",
    more: "تحميل المزيد",
    test: "تجريبي",
  },
  en: {
    title: "Stripe invoices",
    subtitle: "Read live from your Stripe account (read-only). Paid invoices are linked to their payments.",
    all: "All statuses",
    status: { paid: "Paid", open: "Open", draft: "Draft", uncollectible: "Uncollectible", void: "Void" } as Record<string, string>,
    number: "Number",
    customer: "Customer",
    date: "Date",
    total: "Total",
    remaining: "Remaining",
    payment: "Payment",
    open_payment: "Open payment",
    no_payment: "Not linked",
    none: "No invoices",
    more: "Load more",
    test: "Test",
  },
};

const fmtDate = (ms: number) => new Date(ms).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" });

export default function StripeInvoicesPage() {
  const { lang } = useI18n();
  const l = L[lang];
  const [status, setStatus] = useState("");
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (after?: string | null) => {
      setBusy(true);
      setError("");
      try {
        const p = new URLSearchParams();
        if (status) p.set("status", status);
        if (after) p.set("starting_after", after);
        const r = await api<{ invoices: Invoice[]; hasMore: boolean; nextCursor: string | null }>(`/api/stripe/invoices?${p}`);
        setInvoices((prev) => (after && prev ? [...prev, ...r.invoices] : r.invoices));
        setHasMore(r.hasMore);
        setCursor(r.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        if (!after) setInvoices([]);
      } finally {
        setBusy(false);
      }
    },
    [status],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-xs">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{l.title}</h1>
            <p className="mt-0.5 text-xs text-slate-500">{l.subtitle}</p>
          </div>
        </div>
        <div className="w-48">
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">{l.all}</option>
            {Object.entries(l.status).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold text-slate-500">
              <tr>
                <th className="p-3 text-start">{l.number}</th>
                <th className="p-3 text-start">{l.customer}</th>
                <th className="p-3 text-start">{l.date}</th>
                <th className="p-3 text-end">{l.total}</th>
                <th className="p-3 text-start">{lang === "ar" ? "الحالة" : "Status"}</th>
                <th className="p-3 text-start">{l.payment}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices?.length === 0 && !busy && (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-400">
                    <Inbox className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                    <div className="text-xs font-semibold">{l.none}</div>
                  </td>
                </tr>
              )}
              {invoices?.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50/70">
                  <td className="p-3">
                    <div className="num font-bold text-slate-800">{i.number ?? "—"}</div>
                    {!i.livemode && <span className="text-[10px] font-semibold text-amber-600">{l.test}</span>}
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-slate-800">{i.customerName ?? "—"}</div>
                    <div className="num text-xs text-slate-500">{i.customerEmail}</div>
                  </td>
                  <td className="num whitespace-nowrap p-3 text-xs text-slate-600">{fmtDate(i.created)}</td>
                  <td className="whitespace-nowrap p-3 text-end">
                    <div className="num font-bold text-slate-900">{formatMoney(i.total, i.currency)}</div>
                    {i.amountRemaining > 0 && (
                      <div className="num text-[11px] text-amber-600">
                        {l.remaining}: {formatMoney(i.amountRemaining, i.currency)}
                      </div>
                    )}
                  </td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[i.status ?? ""] ?? "gray"}>{l.status[i.status ?? ""] ?? i.status ?? "—"}</Badge>
                  </td>
                  <td className="p-3 text-xs">
                    {i.paymentId ? (
                      <Link href={`/payments/${i.paymentId}`} className="font-semibold text-brand hover:underline">
                        {l.open_payment}
                        {i.zohoInvoiceNumber ? <span className="num ms-1 text-slate-500">({i.zohoInvoiceNumber})</span> : null}
                      </Link>
                    ) : (
                      <span className="text-slate-400">{l.no_payment}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap p-3 text-end text-xs">
                    {i.hostedUrl && (
                      <a href={i.hostedUrl} target="_blank" rel="noreferrer" className="me-3 inline-flex items-center gap-1 text-indigo-600 hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" />
                        {lang === "ar" ? "عرض" : "View"}
                      </a>
                    )}
                    {i.pdf && (
                      <a href={i.pdf} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                        PDF
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {hasMore && (
        <div className="flex justify-center">
          <Button variant="secondary" loading={busy} onClick={() => load(cursor)}>
            {l.more}
          </Button>
        </div>
      )}
    </div>
  );
}
