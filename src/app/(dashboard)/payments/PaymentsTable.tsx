"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Badge, Button, ziinaTone, zohoTone } from "@/components/ui";
import { ItemPicker } from "@/components/ItemPicker";
import { api } from "@/components/fetcher";
import { formatMoney } from "@/lib/money";
import { ZIINA_STATUS_LABEL, ZOHO_STATUS_LABEL, type Tab } from "@/lib/status";

export interface Row {
  id: string;
  ziinaIntentId: string;
  amountFils: number;
  currency: string;
  status: string;
  zohoStatus: string;
  customerName: string | null;
  customerEmail: string | null;
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
}

const fmtDate = (s: string) =>
  new Date(s).toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "short", timeStyle: "short" });

export function PaymentsTable({ payments, tab }: { payments: Row[]; tab: Tab }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [item, setItem] = useState<{ id: string; name: string }>({ id: "", name: "" });
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const canSync = (p: Row) => p.status === "completed" && p.zohoStatus !== "paid" && p.candidateCount === 0;
  const selectable = payments.filter(canSync);
  const canBulk = tab === "to_invoice" || tab === "errors" || tab === "invoiced";

  function toggle(id: string) {
    const s = new Set(selected);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelected(s);
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
      setMsg({
        tone: failed.length ? "error" : "success",
        text: `تم ترحيل ${ok} من ${r.results.length}.${failed.length ? " الأخطاء: " + failed.map((f) => f.error).join(" | ") : ""}`,
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

  return (
    <div className="space-y-3">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {canBulk && selectable.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white p-3">
          <span className="text-sm text-gray-600">المحدد: {selected.size}</span>
          <Button variant="secondary" onClick={() => setSelected(new Set(selectable.map((p) => p.id)))}>
            تحديد الكل
          </Button>
          <Button disabled={!selected.size} onClick={() => setBulkOpen((v) => !v)}>
            ترحيل المحدد إلى Zoho
          </Button>
        </div>
      )}

      {bulkOpen && (
        <div className="space-y-3 rounded-xl border border-brand/30 bg-white p-4">
          <div className="text-sm font-medium">اختر الخدمة لكل الدفعات المحددة ({selected.size})</div>
          <p className="text-xs text-gray-500">الدفعات التي ليس لها اسم أو إيميل عميل ستفشل ويجب إكمالها من صفحة التفاصيل.</p>
          <ItemPicker value={item.id} onChange={(id, name) => setItem({ id, name })} />
          <label className="flex items-center gap-2">
            <input type="checkbox" className="w-auto" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
            إرسال الفاتورة بالإيميل للعملاء
          </label>
          <Button loading={busy} disabled={!item.id} onClick={bulkSync}>
            تنفيذ الترحيل
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 text-right text-xs text-gray-500">
            <tr>
              {canBulk && <th className="w-8 p-3" />}
              <th className="p-3">التاريخ</th>
              <th className="p-3">العميل</th>
              <th className="p-3">الوصف</th>
              <th className="p-3">المبلغ</th>
              <th className="p-3">Ziina</th>
              <th className="p-3">Zoho</th>
              <th className="p-3">الفاتورة</th>
              <th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-400">
                  لا توجد دفعات في هذا القسم
                </td>
              </tr>
            )}
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-gray-100 hover:bg-gray-50">
                {canBulk && (
                  <td className="p-3">
                    {canSync(p) && (
                      <input type="checkbox" className="w-auto" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                    )}
                  </td>
                )}
                <td className="num p-3 whitespace-nowrap text-gray-600">{fmtDate(p.paidAt ?? p.createdAt)}</td>
                <td className="p-3">
                  <div className="font-medium">{p.customerName || <span className="text-amber-600">— بدون اسم —</span>}</div>
                  <div className="num text-xs text-gray-500">{p.customerEmail}</div>
                </td>
                <td className="max-w-56 truncate p-3 text-gray-600" title={p.message ?? ""}>
                  {p.message}
                </td>
                <td className="num p-3 font-semibold whitespace-nowrap">{formatMoney(p.amountFils, p.currency)}</td>
                <td className="p-3">
                  <Badge tone={ziinaTone(p.status)}>{ZIINA_STATUS_LABEL[p.status] ?? p.status}</Badge>
                  {p.test && <span className="ms-1 text-xs text-amber-600">تجريبي</span>}
                </td>
                <td className="p-3">
                  <Badge tone={zohoTone(p.zohoStatus)}>{ZOHO_STATUS_LABEL[p.zohoStatus] ?? p.zohoStatus}</Badge>
                  {p.candidateCount > 0 && p.zohoStatus !== "paid" && (
                    <span className="ms-1">
                      <Badge tone="yellow">تطابق محتمل ({p.candidateCount})</Badge>
                    </span>
                  )}
                  {p.status === "completed" && (
                    <div className="mt-1 text-[11px] text-gray-400">
                      {p.checkedAt ? `تم التحقق ${fmtDate(p.checkedAt)}` : "لم يتم التحقق مع Zoho"}
                    </div>
                  )}
                  {p.lastError && (
                    <div className="mt-1 max-w-48 truncate text-xs text-red-600" title={p.lastError}>
                      {p.lastError}
                    </div>
                  )}
                </td>
                <td className="num p-3">{p.zohoInvoiceNumber ?? "—"}</td>
                <td className="p-3 text-left whitespace-nowrap">
                  <Link href={`/payments/${p.id}`} className="text-brand hover:underline">
                    {p.candidateCount > 0 && p.zohoStatus !== "paid" ? "مراجعة ←" : canSync(p) ? "إصدار فاتورة ←" : "تفاصيل"}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
