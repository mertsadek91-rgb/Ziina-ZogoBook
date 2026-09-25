"use client";

import { useState } from "react";
import Link from "next/link";
import {
  PlusCircle,
  Sparkles,
  ShieldCheck,
  CreditCard,
  User,
  Mail,
  Phone,
  FileText,
  Clock,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { Alert, Button, Card, Badge } from "@/components/ui";
import { LinkResult } from "@/components/LinkResult";
import { api } from "@/components/fetcher";
import { decimalsOf, formatMoney, toMinor } from "@/lib/money";
import { CurrencyHint, CurrencySelect } from "@/components/CurrencySelect";
import { useI18n } from "@/lib/i18n";

interface Created {
  id: string;
  redirectUrl: string;
  amountFils: number;
  currency: string;
  message: string | null;
}

export default function NewLinkPage() {
  const { t, lang, dir } = useI18n();
  const [currency, setCurrency] = useState("AED");
  const [allowTips, setAllowTips] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    message: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    notes: "",
    expiryHours: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ payment: Created }>("/api/payments", {
        body: { ...form, currency, allowTips, expiryHours: form.expiryHours || undefined },
      });
      setCreated(r.payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  // Same conversion the server uses, so the preview shows the exact amount of the link
  // (3-decimal currencies are rounded to the nearest ten base units).
  const numAmount = parseFloat(form.amount) || 0;
  const previewFils = numAmount > 0 ? toMinor(numAmount, currency) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.new_link_page_title}</h1>
        <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">{t.new_link_page_desc}</p>
      </div>

      {created ? (
        <div className="mx-auto max-w-2xl space-y-4">
          <LinkResult
            url={created.redirectUrl}
            amountLabel={formatMoney(created.amountFils, created.currency)}
            message={created.message ?? undefined}
          />
          <div className="flex flex-wrap gap-2.5">
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setForm({
                  amount: "",
                  message: "",
                  customerName: "",
                  customerEmail: "",
                  customerPhone: "",
                  notes: "",
                  expiryHours: "",
                });
              }}
            >
              <RefreshCw className="h-4 w-4" />
              <span>{t.create_another_link}</span>
            </Button>
            <Link href={`/payments/${created.id}`}>
              <Button variant="ghost">
                <span>{t.view_payment}</span>
                {dir === "rtl" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        /* Widescreen 2-Column Split: Form (7 cols) + Live Preview (5 cols) */
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Form */}
          <div className="lg:col-span-7">
            <Card>
              <form onSubmit={submit} className="space-y-4">
                {error && <Alert tone="error">{error}</Alert>}

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <label>{t.amount_required}</label>
                    <input
                      type="number"
                      step={decimalsOf(currency) === 3 ? "0.001" : "0.01"}
                      min={currency === "AED" ? "2" : "0.01"}
                      required
                      dir="ltr"
                      placeholder="0.00"
                      className="font-bold text-base"
                      value={form.amount}
                      onChange={set("amount")}
                    />
                  </div>
                  <div>
                    <label>{t.currency_label}</label>
                    <CurrencySelect value={currency} onChange={setCurrency} />
                  </div>
                  <div>
                    <label>{t.expiry_label}</label>
                    <div className="relative">
                      <Clock className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-4 w-4 text-slate-400" />
                      <input
                        type="number"
                        min="1"
                        dir="ltr"
                        placeholder="24"
                        value={form.expiryHours}
                        onChange={set("expiryHours")}
                        className="ps-9"
                      />
                    </div>
                  </div>
                </div>

                <CurrencyHint currency={currency} />

                <label className="flex items-center gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer pt-1">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/20"
                    checked={allowTips}
                    onChange={(e) => setAllowTips(e.target.checked)}
                  />
                  <span>{t.allow_tips_label}</span>
                </label>

                <div>
                  <label>{t.message_label}</label>
                  <input
                    value={form.message}
                    onChange={set("message")}
                    placeholder={t.message_placeholder}
                  />
                </div>

                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2.5">
                    {lang === "ar" ? "بيانات العميل (اختيارية ولكن يُنصح بها)" : "Customer Details (Recommended for Zoho)"}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label>{t.customer_name}</label>
                      <div className="relative">
                        <User className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
                        <input
                          value={form.customerName}
                          onChange={set("customerName")}
                          className="ps-9"
                        />
                      </div>
                    </div>
                    <div>
                      <label>{t.customer_email}</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
                        <input
                          type="email"
                          dir="ltr"
                          value={form.customerEmail}
                          onChange={set("customerEmail")}
                          className="ps-9"
                        />
                      </div>
                    </div>
                    <div>
                      <label>{t.customer_phone}</label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
                        <input
                          dir="ltr"
                          value={form.customerPhone}
                          onChange={set("customerPhone")}
                          className="ps-9"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label>{t.internal_notes}</label>
                  <textarea rows={2} value={form.notes} onChange={set("notes")} />
                </div>

                <Button type="submit" loading={busy} size="lg" className="w-full">
                  <PlusCircle className="h-4 w-4" />
                  <span>{t.create_link_submit}</span>
                </Button>
              </form>
            </Card>
          </div>

          {/* Right Column: Live Interactive Card Preview */}
          <div className="lg:col-span-5">
            <div className="sticky top-6 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                <span>{t.live_preview_title}</span>
              </div>

              {/* Simulated Customer Checkout Card */}
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md transition-all">
                {/* Header Banner */}
                <div className="bg-gradient-to-r from-brand to-brand-dark p-5 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium opacity-80">Ziina Pay Checkout</span>
                    <span className="rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold">
                      {currency}
                    </span>
                  </div>
                  <div className="mt-3">
                    <div className="text-xs opacity-75">{lang === "ar" ? "المبلغ المستحق للدفع" : "Total Amount Due"}</div>
                    <div className="num text-3xl font-extrabold tracking-tight mt-0.5">
                      {formatMoney(previewFils, currency)}
                    </div>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-4">
                  <div>
                    <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      {t.col_desc}
                    </span>
                    <p className="text-sm font-medium text-slate-800 mt-0.5">
                      {form.message || (
                        <span className="text-slate-300 italic">
                          {lang === "ar" ? "سيظهر وصف الدفعة هنا..." : "Payment description will appear here..."}
                        </span>
                      )}
                    </p>
                  </div>

                  {(form.customerName || form.customerEmail) && (
                    <div className="rounded-xl bg-slate-50 p-3 text-xs space-y-1 border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                        {t.col_customer}
                      </span>
                      {form.customerName && <div className="font-bold text-slate-800">{form.customerName}</div>}
                      {form.customerEmail && <div className="num text-slate-500">{form.customerEmail}</div>}
                    </div>
                  )}

                  {allowTips && (
                    <div className="flex items-center justify-between rounded-xl border border-dashed border-amber-200 bg-amber-50/50 p-2.5 text-xs text-amber-900 font-medium">
                      <span>{lang === "ar" ? "إكرامية اختيارية للعميل" : "Optional tip during checkout"}</span>
                      <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold">
                        {lang === "ar" ? "مفعّلة" : "Enabled"}
                      </span>
                    </div>
                  )}

                  {/* Simulated Pay Button */}
                  <div className="pt-2">
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-xs cursor-default">
                      <CreditCard className="h-4 w-4" />
                      <span>{t.pay_now_preview}</span>
                    </div>
                  </div>

                  {/* Footer Security Seal */}
                  <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 pt-2 border-t border-slate-100">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>{t.powered_by_ziina}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
