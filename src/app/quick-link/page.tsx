"use client";

import { useState } from "react";
import Link from "next/link";
import { Zap, ArrowLeft, ArrowRight, Sparkles } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { LinkResult } from "@/components/LinkResult";
import { api } from "@/components/fetcher";
import { formatMoney } from "@/lib/money";
import { CurrencyHint, CurrencySelect } from "@/components/CurrencySelect";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

const PRESETS = [100, 250, 500, 1000, 2500];

export default function QuickLinkPage() {
  const { t, lang, dir } = useI18n();
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("AED");
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
        body: { amount, currency, message: message || undefined },
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
    <div className="flex min-h-screen items-start justify-center px-4 py-8 sm:items-center sm:py-12 bg-slate-50/70">
      <div className="w-full max-w-lg space-y-5">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 font-bold">
              <Zap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">{t.quick_link_page_title}</h1>
              <p className="text-[11px] text-slate-500">{t.enter_amount_hint}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              href="/payments"
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <span>{t.nav_payments}</span>
              {dir === "rtl" ? <ArrowLeft className="h-3 w-3" /> : <ArrowRight className="h-3 w-3" />}
            </Link>
          </div>
        </div>

        {/* Form Card */}
        <form onSubmit={create} className="space-y-4 rounded-2xl border border-slate-200/90 bg-white p-6 shadow-xs">
          {error && <Alert tone="error">{error}</Alert>}

          <div>
            <label>{t.currency_label}</label>
            <CurrencySelect
              value={currency}
              onChange={(c) => {
                setCurrency(c);
                setResult(null);
              }}
            />
          </div>

          <div>
            <label>{t.amount_required} ({currency})</label>
            <input
              type="number"
              step={["KWD", "BHD", "OMR"].includes(currency) ? "0.001" : "0.01"}
              min={currency === "AED" ? "2" : "0.01"}
              required
              autoFocus
              dir="ltr"
              placeholder="0.00"
              className="py-4 text-center text-3xl font-extrabold tracking-tight text-slate-900 focus:border-brand"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setResult(null);
              }}
            />
          </div>

          {/* Quick Presets */}
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              {t.quick_presets}
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
                  className={`num rounded-xl border px-3 py-1.5 text-xs font-bold transition active:scale-95 ${
                    amount === String(v)
                      ? "border-brand bg-brand text-white shadow-xs"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>

          <CurrencyHint currency={currency} />

          <div>
            <label>{t.message_label} ({t.optional})</label>
            <input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={lang === "ar" ? "مثال: استشارة سريعة" : "e.g. Quick Consultation"}
            />
          </div>

          <Button type="submit" loading={busy} size="lg" className="w-full text-base">
            <Zap className="h-4 w-4" />
            <span>{t.create_link_submit}</span>
          </Button>
        </form>

        {result && <LinkResult url={result.url} amountLabel={result.label} message={result.message} />}

        <p className="text-center text-xs text-slate-400 leading-relaxed px-4">
          {t.quick_link_notice}
        </p>
      </div>
    </div>
  );
}
