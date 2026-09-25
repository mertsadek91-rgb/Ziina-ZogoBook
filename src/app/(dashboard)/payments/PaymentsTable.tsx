"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Inbox,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  Send,
  AlertTriangle,
  Mail,
  Calendar,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Alert, Badge, Button, ziinaTone, zohoTone } from "@/components/ui";
import { ItemPicker } from "@/components/ItemPicker";
import { PartnerSelect } from "@/components/ledger";
import { useAcc } from "@/lib/i18n-acc";
import { api } from "@/components/fetcher";
import { formatMoney } from "@/lib/money";
import { type Tab } from "@/lib/status";
import { useI18n } from "@/lib/i18n";

export interface Row {
  id: string;
  ziinaIntentId: string;
  amountFils: number;
  currency: string;
  originalAmountFils: number | null;
  originalCurrency: string | null;
  status: string;
  zohoStatus: string;
  customerName: string | null;
  customerEmail: string | null;
  orderNumber: string | null;
  message: string | null;
  zohoInvoiceNumber: string | null;
  redirectUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  test: boolean;
  lastError: string | null;
  source: string;
  candidateCount: number;
  checkedAt: string | null;
  partnerAccountId: string | null;
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "short", timeStyle: "short" });

export function PaymentsTable({
  payments,
  tab,
  partners = [],
}: {
  payments: Row[];
  tab: Tab;
  partners?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const { t, lang, dir } = useI18n();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [item, setItem] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const { a } = useAcc();

  // Partner assignment (accounting): kept locally so the select updates instantly.
  const [partnerOf, setPartnerOf] = useState<Record<string, string>>({});
  useEffect(() => {
    setPartnerOf(Object.fromEntries(payments.map((p) => [p.id, p.partnerAccountId ?? ""])));
  }, [payments]);
  const [bulkPartner, setBulkPartner] = useState("");
  const [assigning, setAssigning] = useState(false);
  const unassigned = payments.filter((p) => p.status === "completed" && !partnerOf[p.id]);

  async function assignPartner(id: string, partnerAccountId: string) {
    const prev = partnerOf[id] ?? "";
    setPartnerOf((m) => ({ ...m, [id]: partnerAccountId }));
    try {
      await api(`/api/payments/${id}`, { method: "PATCH", body: { partnerAccountId: partnerAccountId || null } });
    } catch (e) {
      setPartnerOf((m) => ({ ...m, [id]: prev }));
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }

  async function assignAllUnassigned() {
    if (!bulkPartner || !unassigned.length) return;
    setAssigning(true);
    try {
      await api("/api/payments/assign-partner", { body: { ids: unassigned.map((p) => p.id), partnerAccountId: bulkPartner } });
      setPartnerOf((m) => ({ ...m, ...Object.fromEntries(unassigned.map((p) => [p.id, bulkPartner])) }));
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setAssigning(false);
    }
  }

  const canSync = (p: Row) => p.status === "completed" && p.zohoStatus !== "paid" && p.candidateCount === 0;
  const selectable = payments.filter(canSync);
  const canBulk = tab === "to_invoice" || tab === "errors" || tab === "invoiced";

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
  }

  function toggleSelectAll() {
    if (selected.size === selectable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectable.map((p) => p.id)));
    }
  }

  async function bulkSync() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ results: { id: string; ok: boolean; error?: string }[] }>("/api/payments/bulk-sync", {
        body: { ids: [...selected], itemId: item.id, itemName: item.name, sendEmail },
      });
      const ok = r.results.filter((x) => x.ok).length;
      const failed = r.results.filter((x) => !x.ok);
      const successText =
        lang === "ar"
          ? `تم ترحيل ${ok} من ${r.results.length}.${failed.length ? " الأخطاء: " + failed.map((f) => f.error).join(" | ") : ""}`
          : `Synced ${ok} of ${r.results.length}.${failed.length ? " Errors: " + failed.map((f) => f.error).join(" | ") : ""}`;

      setMsg({
        tone: failed.length ? "error" : "success",
        text: successText,
      });
      setSelected(new Set());
      setBulkOpen(false);
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const getZiinaStatusLabel = (status: string) => {
    const key = `ziina_${status}` as keyof typeof t;
    return (t[key] as string) || status;
  };

  const getZohoStatusLabel = (status: string) => {
    const key = `zoho_${status}` as keyof typeof t;
    return (t[key] as string) || status;
  };

  return (
    <div className="space-y-4">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {/* Assign every unassigned (paid) payment in this list to one partner */}
      {partners.length > 0 && unassigned.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 text-xs">
          <span className="font-semibold text-amber-800">
            {a.unassigned_title}: <span className="num">{unassigned.length}</span>
          </span>
          <div className="w-48">
            <PartnerSelect compact partners={partners} value={bulkPartner} onChange={setBulkPartner} />
          </div>
          <Button size="sm" variant="secondary" loading={assigning} disabled={!bulkPartner} onClick={assignAllUnassigned}>
            {a.assign_partner}
          </Button>
        </div>
      )}

      {/* Bulk Sync Action Bar */}
      {canBulk && selectable.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleSelectAll}
              className="flex items-center gap-2 text-xs font-semibold text-slate-700 hover:text-brand"
            >
              {selected.size === selectable.length ? (
                <CheckSquare className="h-4 w-4 text-brand" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span>
                {t.selected_count}: <b className="num text-slate-900">{selected.size}</b> / {selectable.length}
              </span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!selected.size}
              onClick={() => setBulkOpen((v) => !v)}
            >
              <Send className="h-3.5 w-3.5" />
              <span>{t.bulk_sync}</span>
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Sync Drawer / Form */}
      {bulkOpen && (
        <div className="space-y-4 rounded-2xl border border-brand/20 bg-brand-50/40 p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="text-sm font-bold text-slate-900">
              {t.bulk_title} ({selected.size})
            </div>
            <button
              type="button"
              onClick={() => setBulkOpen(false)}
              className="text-xs text-slate-400 hover:text-slate-700"
            >
              {t.cancel}
            </button>
          </div>
          <p className="text-xs text-slate-500">{t.bulk_notice}</p>
          <ItemPicker value={item.id} onChange={(id, name) => setItem({ id, name })} />
          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/20"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            <span>{t.bulk_email_checkbox}</span>
          </label>
          <Button loading={busy} disabled={!item.id || !selected.size} onClick={bulkSync}>
            {t.bulk_execute} ({selected.size})
          </Button>
        </div>
      )}

      {/* Mobile Card List View (visible on < md screens) */}
      <div className="space-y-3 md:hidden">
        {payments.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-8 text-center">
            <Inbox className="h-10 w-10 text-slate-300 mb-2" />
            <div className="text-sm font-semibold text-slate-700">{t.no_payments_in_tab}</div>
          </div>
        ) : (
          payments.map((p) => (
            <div
              key={p.id}
              className="relative rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {canBulk && canSync(p) && (
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/20"
                      checked={selected.has(p.id)}
                      onChange={() => toggle(p.id)}
                    />
                  )}
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      {p.customerName || <span className="text-amber-600 font-medium">{t.no_name}</span>}
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-0.5">
                      {p.orderNumber && (
                        <span className="num font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded">
                          #{p.orderNumber}
                        </span>
                      )}
                      {p.customerEmail && <span className="truncate max-w-[180px]">{p.customerEmail}</span>}
                    </div>
                  </div>
                </div>

                <div className="text-end shrink-0">
                  <div className="num font-bold text-base text-slate-900">
                    {formatMoney(p.amountFils, p.currency)}
                  </div>
                  {p.originalAmountFils != null && p.originalCurrency && (
                    <div className="num text-[11px] text-slate-400">
                      {formatMoney(p.originalAmountFils, p.originalCurrency)}
                    </div>
                  )}
                </div>
              </div>

              {p.message && <div className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-xl">{p.message}</div>}

              {partners.length > 0 && (
                <div className="flex items-center gap-2 text-xs">
                  <span className="shrink-0 font-semibold text-slate-500">{a.partner}</span>
                  <PartnerSelect compact partners={partners} value={partnerOf[p.id] ?? ""} onChange={(v) => assignPartner(p.id, v)} />
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={ziinaTone(p.status)} dot>
                    {getZiinaStatusLabel(p.status)}
                  </Badge>
                  <Badge tone={zohoTone(p.zohoStatus)}>
                    {getZohoStatusLabel(p.zohoStatus)}
                  </Badge>
                  {p.test && <Badge tone="yellow">{t.test_pill}</Badge>}
                  {p.candidateCount > 0 && p.zohoStatus !== "paid" && (
                    <Badge tone="yellow">
                      <AlertTriangle className="h-3 w-3 inline" /> {t.potential_match} ({p.candidateCount})
                    </Badge>
                  )}
                </div>

                <Link
                  href={`/payments/${p.id}`}
                  className="inline-flex items-center gap-1 font-semibold text-brand hover:underline"
                >
                  <span>
                    {p.candidateCount > 0 && p.zohoStatus !== "paid"
                      ? t.review_arrow
                      : canSync(p)
                        ? t.invoice_arrow
                        : t.details}
                  </span>
                  {dir === "rtl" ? <ArrowLeft className="h-3.5 w-3.5" /> : <ArrowRight className="h-3.5 w-3.5" />}
                </Link>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View (visible on >= md screens) */}
      <div className="hidden overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xs md:block">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <tr>
                {canBulk && <th className="w-10 px-4 py-3.5" />}
                <th className="px-4 py-3.5 text-start">{t.col_date}</th>
                <th className="px-4 py-3.5 text-start">{t.col_customer}</th>
                <th className="px-4 py-3.5 text-start">{t.col_desc}</th>
                <th className="px-4 py-3.5 text-start">{t.col_amount}</th>
                <th className="px-4 py-3.5 text-start">{a.partner}</th>
                <th className="px-4 py-3.5 text-start">{t.col_ziina}</th>
                <th className="px-4 py-3.5 text-start">{t.col_zoho}</th>
                <th className="px-4 py-3.5 text-start">{t.col_invoice}</th>
                <th className="px-4 py-3.5 text-end">{t.actions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.length === 0 && (
                <tr>
                  <td colSpan={canBulk ? 10 : 9} className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <Inbox className="h-10 w-10 text-slate-300 mb-2" />
                      <div className="text-sm font-semibold text-slate-600">{t.no_payments_in_tab}</div>
                    </div>
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="transition duration-100 hover:bg-slate-50/80 group">
                  {canBulk && (
                    <td className="px-4 py-3.5">
                      {canSync(p) && (
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/20 cursor-pointer"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                        />
                      )}
                    </td>
                  )}

                  <td className="num whitespace-nowrap px-4 py-3.5 text-xs text-slate-500 font-medium">
                    {fmtDate(p.paidAt ?? p.createdAt)}
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="font-bold text-slate-900">
                      {p.customerName || <span className="font-normal text-amber-600">{t.no_name}</span>}
                    </div>
                    <div className="num mt-0.5 text-xs text-slate-500 flex items-center gap-1.5">
                      {p.orderNumber && (
                        <span className="font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                          #{p.orderNumber}
                        </span>
                      )}
                      <span>{p.customerEmail}</span>
                    </div>
                  </td>

                  <td className="max-w-48 truncate px-4 py-3.5 text-xs text-slate-600" title={p.message ?? ""}>
                    {p.message || <span className="text-slate-300">—</span>}
                  </td>

                  <td className="num whitespace-nowrap px-4 py-3.5">
                    <div className="font-bold text-slate-900">{formatMoney(p.amountFils, p.currency)}</div>
                    {p.originalAmountFils != null && p.originalCurrency && (
                      <div className="text-xs text-slate-400">{formatMoney(p.originalAmountFils, p.originalCurrency)}</div>
                    )}
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="w-36">
                      <PartnerSelect compact partners={partners} value={partnerOf[p.id] ?? ""} onChange={(v) => assignPartner(p.id, v)} />
                    </div>
                  </td>
                  <td className="px-4 py-3.5 whitespace-nowrap">
                    <Badge tone={ziinaTone(p.status)} dot pulse={p.status === "pending"}>
                      {getZiinaStatusLabel(p.status)}
                    </Badge>
                    {p.test && <span className="ms-1.5 text-xs font-semibold text-amber-600">{t.test_pill}</span>}
                  </td>

                  <td className="px-4 py-3.5">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge tone={zohoTone(p.zohoStatus)}>{getZohoStatusLabel(p.zohoStatus)}</Badge>
                      {p.candidateCount > 0 && p.zohoStatus !== "paid" && (
                        <Badge tone="yellow">
                          <AlertTriangle className="h-3 w-3 inline mr-0.5" />
                          {t.potential_match} ({p.candidateCount})
                        </Badge>
                      )}
                    </div>
                    {p.status === "completed" && (
                      <div className="mt-1 text-[11px] text-slate-400">
                        {p.checkedAt ? `${t.verified_at} ${fmtDate(p.checkedAt)}` : t.not_verified_zoho}
                      </div>
                    )}
                    {p.lastError && (
                      <div className="mt-1 max-w-44 truncate text-xs font-medium text-rose-600" title={p.lastError}>
                        {p.lastError}
                      </div>
                    )}
                  </td>

                  <td className="num px-4 py-3.5 text-xs font-medium text-slate-700">{p.zohoInvoiceNumber ?? "—"}</td>

                  <td className="whitespace-nowrap px-4 py-3.5 text-end">
                    <Link
                      href={`/payments/${p.id}`}
                      className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold text-brand hover:bg-brand-50 transition"
                    >
                      <span>
                        {p.candidateCount > 0 && p.zohoStatus !== "paid"
                          ? t.review_arrow
                          : canSync(p)
                            ? t.invoice_arrow
                            : t.details}
                      </span>
                      {dir === "rtl" ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
