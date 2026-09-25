"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button } from "@/components/ui";
import { LinkResult } from "@/components/LinkResult";
import { api } from "@/components/fetcher";
import { formatMoney } from "@/lib/money";

const PRESETS = [100, 250, 500, 1000];

export default function QuickLinkPage() {
  const [amount, setAmount] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ url: string; label: string; message?: string } | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ payment: { redirectUrl: string; amountFils: number; currency: string } }>("/api/payments", {
        body: { amount, message: message || undefined },
      });
      setResult({
        url: r.payment.redirectUrl,
        label: formatMoney(r.payment.amountFils, r.payment.currency),
        message: message || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-start justify-center px-4 py-10 sm:items-center">
      <div className="w-full max-w-lg space-y-5">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">رابط دفع سريع</h1>
          <Link href="/payments" className="text-sm text-gray-500 hover:text-gray-800">
            لوحة التحكم ←
          </Link>
        </div>

        <form onSubmit={create} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          {error && <Alert tone="error">{error}</Alert>}
          <div>
            <label>المبلغ (AED)</label>
            <input
              type="number"
              step="0.01"
              min="2"
              required
              autoFocus
              dir="ltr"
              className="!py-4 text-center !text-3xl font-bold"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setResult(null);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((v) => (
              <button
                type="button"
                key={v}
                onClick={() => {
                  setAmount(String(v));
                  setResult(null);
                }}
                className="num rounded-full border border-gray-300 px-3 py-1 text-sm hover:border-brand hover:text-brand"
              >
                {v}
              </button>
            ))}
          </div>
          <div>
            <label>وصف (اختياري)</label>
            <input value={message} onChange={(e) => setMessage(e.target.value)} />
          </div>
          <Button type="submit" loading={busy} className="w-full !py-3 !text-base">
            إنشاء الرابط
          </Button>
        </form>

        {result && <LinkResult url={result.url} amountLabel={result.label} message={result.message} />}
        <p className="text-center text-xs text-gray-400">
          الرابط يُسجَّل تلقائيًا في قائمة الدفعات. يمكنك إضافة بيانات العميل لاحقًا قبل إصدار الفاتورة.
        </p>
      </div>
    </div>
  );
}
