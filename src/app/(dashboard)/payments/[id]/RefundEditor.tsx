"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Undo2 } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/components/fetcher";
import { formatMoney, fromMinor } from "@/lib/money";
import { useI18n } from "@/lib/i18n";

interface Props {
  id: string;
  amountFils: number;
  tipFils: number;
  currency: string;
  originalAmountFils: number | null;
  originalCurrency: string | null;
  amountRefundedFils: number;
  zohoInvoiceNumber: string | null;
}

/** Record a (partial) refund made in the Ziina app, so the invoice is issued for what was kept. */
export function RefundEditor(p: Props) {
  const router = useRouter();
  const { lang } = useI18n();
  const ar = lang === "ar";
  const foreign = !!(p.originalAmountFils && p.originalCurrency);
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState(foreign ? p.originalCurrency! : "AED");
  const [amount, setAmount] = useState(() => {
    if (!p.amountRefundedFils) return "";
    if (!foreign) return String(fromMinor(p.amountRefundedFils, "AED"));
    const orig = (p.amountRefundedFils * p.originalAmountFils!) / (p.amountFils + p.tipFils);
    return String(fromMinor(Math.round(orig), p.originalCurrency!));
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const gross = p.amountFils + p.tipFils;
  const n = Number(amount);
  // Preview in AED, converted at the rate of the original payment.
  const previewFils =
    !amount || !Number.isFinite(n)
      ? null
      : currency === "AED"
        ? Math.round(n * 100)
        : Math.round((gross * n) / fromMinor(p.originalAmountFils!, currency));

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api(`/api/payments/${p.id}/refund`, { body: { amount: amount || 0, currency } });
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:underline">
        <Undo2 className="h-3.5 w-3.5" />
        {p.amountRefundedFils ? (ar ? "تعديل المبلغ المسترد" : "Edit refunded amount") : ar ? "تسجيل استرداد (كلي أو جزئي)" : "Record a refund"}
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-3">
      <div className="text-xs font-bold text-slate-800">{ar ? "إجمالي المبلغ المسترد للعميل" : "Total refunded to the customer"}</div>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="num"
          autoFocus
        />
        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="!w-28">
          {foreign && <option value={p.originalCurrency!}>{p.originalCurrency}</option>}
          <option value="AED">AED</option>
        </select>
      </div>
      {foreign && currency !== "AED" && (
        <p className="text-[11px] text-slate-500">
          {ar
            ? `العميل دفع ${formatMoney(p.originalAmountFils!, p.originalCurrency!)} = ${formatMoney(gross, "AED")} — يُحوَّل المسترد بنفس السعر`
            : `Customer paid ${formatMoney(p.originalAmountFils!, p.originalCurrency!)} = ${formatMoney(gross, "AED")} — converted at the same rate`}
        </p>
      )}
      {previewFils != null && previewFils >= 0 && previewFils <= gross && (
        <div className="text-xs text-slate-700">
          {ar ? "المسترد" : "Refunded"}: <b className="num text-rose-600">{formatMoney(previewFils, "AED")}</b> ·{" "}
          {ar ? "قيمة الفاتورة" : "Invoice amount"}: <b className="num text-emerald-700">{formatMoney(gross - previewFils, "AED")}</b>
        </div>
      )}
      {p.zohoInvoiceNumber && (
        <p className="text-[11px] font-medium text-amber-700">
          {ar
            ? `الفاتورة ${p.zohoInvoiceNumber} صدرت بالفعل في Zoho بالمبلغ القديم — عدّلها أو أصدر إشعار دائن (Credit Note) في Zoho يدويًا`
            : `Invoice ${p.zohoInvoiceNumber} already exists in Zoho with the old amount — adjust it or add a credit note in Zoho`}
        </p>
      )}
      {error && <p className="text-xs text-rose-700">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" loading={busy} onClick={save}>
          {ar ? "حفظ" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
          {ar ? "إلغاء" : "Cancel"}
        </Button>
      </div>
    </div>
  );
}
