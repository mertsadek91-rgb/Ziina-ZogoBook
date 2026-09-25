"use client";

import { CURRENCIES, decimalsOf } from "@/lib/money";
import { useI18n } from "@/lib/i18n";

export function CurrencySelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (code: string) => void;
  className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={className}>
      {CURRENCIES.map((c) => (
        <option key={c.code} value={c.code}>
          {c.code} — {c.label}
        </option>
      ))}
    </select>
  );
}

/** Explains how a non-AED link behaves (shown under the form). */
export function CurrencyHint({ currency }: { currency: string }) {
  const { lang } = useI18n();
  if (currency === "AED") return null;

  return (
    <div className="rounded-xl border border-amber-200/80 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900">
      {lang === "ar" ? (
        <>
          سيدفع العميل بـ <b>{currency}</b>، وتحوّل Ziina المبلغ إلى الدرهم بسعر الصرف لحظة الدفع (مع رسوم تحويل). الفاتورة في
          Zoho تُصدر بالمبلغ الذي يصلك بالدرهم.
          {decimalsOf(currency) === 3 && " هذه العملة بثلاث خانات عشرية وتُقرَّب لأقرب 10 فلوس كما تشترط Ziina."}
        </>
      ) : (
        <>
          Customer will pay in <b>{currency}</b>, and Ziina converts the amount to AED at payment time exchange rate (with
          conversion fees). The invoice in Zoho Books is issued in the net AED amount received.
          {decimalsOf(currency) === 3 && " This currency has 3 decimal places and is rounded to nearest 10 fils by Ziina."}
        </>
      )}
    </div>
  );
}
