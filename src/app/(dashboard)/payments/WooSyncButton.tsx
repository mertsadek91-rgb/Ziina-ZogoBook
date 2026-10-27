"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Globe, X } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/components/fetcher";
import { useI18n } from "@/lib/i18n";
import type { WooSyncReport, WooSyncLine } from "@/lib/woo-sync";

const RESULT_AR: Record<WooSyncLine["result"], string> = {
  new: "أُضيفت",
  updated: "تحدّثت",
  unchanged: "مطابقة",
  unpaid: "غير مدفوعة",
  error: "خطأ",
};
const RESULT_EN: Record<WooSyncLine["result"], string> = {
  new: "Added",
  updated: "Updated",
  unchanged: "In sync",
  unpaid: "Unpaid",
  error: "Error",
};
const RESULT_TONE: Record<WooSyncLine["result"], string> = {
  new: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  updated: "bg-sky-50 text-sky-700 ring-sky-200",
  unchanged: "bg-slate-50 text-slate-600 ring-slate-200",
  unpaid: "bg-amber-50 text-amber-700 ring-amber-200",
  error: "bg-rose-50 text-rose-700 ring-rose-200",
};

const PERIODS = [
  { days: 30, ar: "آخر 30 يومًا", en: "Last 30 days" },
  { days: 90, ar: "آخر 90 يومًا", en: "Last 90 days" },
  { days: 0, ar: "كل الطلبات", en: "All orders" },
];

/** Compare the website's Ziina orders (WooCommerce) with the system and add the missing paid ones. */
export function WooSyncButton() {
  const router = useRouter();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState<WooSyncReport | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(true);

  async function run() {
    setBusy(true);
    setError("");
    setReport(null);
    try {
      const { report: r } = await api<{ report: WooSyncReport }>("/api/woo/sync", {
        body: days ? { sinceDays: days } : {},
      });
      setReport(r);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const lines = report ? report.lines.filter((l) => !onlyChanges || l.result !== "unchanged" || l.mismatch) : [];
  const mismatchText = (m: WooSyncLine["mismatch"]) =>
    m === "paid_not_in_site"
      ? ar
        ? "مدفوعة في Ziina لكن الطلب غير مدفوع في الموقع"
        : "Paid in Ziina, unpaid on the site"
      : m === "site_paid_not_in_ziina"
        ? ar
          ? "الطلب مدفوع في الموقع لكن الدفعة غير مكتملة في Ziina"
          : "Paid on the site, not completed in Ziina"
        : "";

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Globe className="h-4 w-4 text-teal-600" />
        <span>{ar ? "مزامنة طلبات الموقع" : "Sync website orders"}</span>
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8" onClick={() => !busy && setOpen(false)}>
          <div className="w-full max-w-5xl rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">{ar ? "مزامنة طلبات الموقع مع Ziina" : "Sync website orders with Ziina"}</h2>
                <p className="mt-1 text-xs text-slate-500">
                  {ar
                    ? "يقرأ طلبات Ziina من الموقع، ويتحقق من كل دفعة في Ziina، ويضيف المدفوعة الناقصة، ويقارن الحالة القديمة بالجديدة."
                    : "Reads Ziina orders from the site, checks each payment in Ziina, adds missing paid ones and compares old vs new status."}
                </p>
              </div>
              <button className="rounded-lg p-1 text-slate-400 hover:bg-slate-100" onClick={() => !busy && setOpen(false)} aria-label="close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.days}
                  disabled={busy}
                  onClick={() => setDays(p.days)}
                  className={`rounded-xl px-3 py-1.5 text-xs font-bold ring-1 ${
                    days === p.days ? "bg-brand text-white ring-brand" : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {ar ? p.ar : p.en}
                </button>
              ))}
              <Button loading={busy} onClick={run} className="ms-auto">
                {ar ? "ابدأ المزامنة" : "Start sync"}
              </Button>
            </div>

            {busy && <p className="mt-4 text-xs text-slate-500">{ar ? "جارٍ قراءة الطلبات والتحقق منها في Ziina…" : "Reading orders and checking them in Ziina…"}</p>}
            {error && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}

            {report && (
              <div className="mt-5 space-y-4">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
                  <Stat label={ar ? "طلبات Ziina في الموقع" : "Ziina orders"} value={report.orders} />
                  <Stat label={ar ? "أُضيفت للنظام" : "Added"} value={report.counts.new} tone="text-emerald-600" />
                  <Stat label={ar ? "تحدّثت حالتها" : "Updated"} value={report.counts.updated} tone="text-sky-600" />
                  <Stat label={ar ? "مطابقة" : "In sync"} value={report.counts.unchanged} />
                  <Stat label={ar ? "غير مدفوعة" : "Unpaid"} value={report.counts.unpaid} tone="text-amber-600" />
                  <Stat label={ar ? "اختلاف / خطأ" : "Mismatch / error"} value={report.mismatches + report.counts.error} tone="text-rose-600" />
                </div>

                <label className="!mb-0 flex w-fit items-center gap-2 text-xs font-medium text-slate-600">
                  <input type="checkbox" className="!w-4 !p-0" checked={onlyChanges} onChange={(e) => setOnlyChanges(e.target.checked)} />
                  {ar ? "إظهار التغييرات والاختلافات فقط" : "Show changes and mismatches only"}
                </label>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-slate-50 text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2 text-start">{ar ? "الطلب" : "Order"}</th>
                        <th className="px-3 py-2 text-start">{ar ? "العميل" : "Customer"}</th>
                        <th className="num px-3 py-2">{ar ? "المبلغ" : "Total"}</th>
                        <th className="px-3 py-2 text-start">{ar ? "حالة الموقع" : "Site status"}</th>
                        <th className="px-3 py-2 text-start">{ar ? "Ziina: قبل ← بعد" : "Ziina: before → after"}</th>
                        <th className="px-3 py-2 text-start">{ar ? "النتيجة" : "Result"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lines.length === 0 && (
                        <tr>
                          <td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-500">
                            {ar ? "كل الطلبات مطابقة — لا توجد تغييرات" : "Everything is in sync"}
                          </td>
                        </tr>
                      )}
                      {lines.map((l) => (
                        <tr key={`${l.orderId}-${l.intentId}`} className={l.mismatch || l.result === "error" ? "bg-rose-50/40" : ""}>
                          <td className="px-3 py-2 font-bold text-slate-800">
                            {l.paymentId ? (
                              <Link href={`/payments/${l.paymentId}`} className="text-brand hover:underline">
                                #{l.orderNumber}
                              </Link>
                            ) : (
                              <>#{l.orderNumber}</>
                            )}
                          </td>
                          <td className="px-3 py-2 text-slate-600">{l.customer ?? "—"}</td>
                          <td className="num px-3 py-2">
                            {l.total} {l.currency}
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{l.wooStatus}</td>
                          <td className="px-3 py-2 text-xs text-slate-600" dir="ltr">
                            {l.oldStatus ?? "—"} → {l.newStatus ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-bold ring-1 ${RESULT_TONE[l.result]}`}>
                              {(ar ? RESULT_AR : RESULT_EN)[l.result]}
                            </span>
                            {l.mismatch && <div className="mt-1 text-[11px] font-medium text-rose-600">{mismatchText(l.mismatch)}</div>}
                            {l.error && <div className="mt-1 max-w-xs text-[11px] text-rose-600">{l.error}</div>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-2">
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`num text-lg font-extrabold ${tone ?? "text-slate-900"}`}>{value}</div>
    </div>
  );
}
