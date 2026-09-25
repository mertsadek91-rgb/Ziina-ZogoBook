"use client";

import { CURRENCIES, decimalsOf } from "@/lib/money";

export function CurrencySelect({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
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
  if (currency === "AED") return null;
  return (
    <p className="text-xs text-gray-500">
      سيدفع العميل بـ {currency}، وتحوّل Ziina المبلغ إلى الدرهم بسعر الصرف لحظة الدفع (مع رسوم تحويل). الفاتورة في Zoho تُصدر
      بالمبلغ الذي يصلك بالدرهم.
      {decimalsOf(currency) === 3 && " هذه العملة بثلاث خانات عشرية وتُقرَّب لأقرب 10 فلوس كما تشترط Ziina."}
    </p>
  );
}
