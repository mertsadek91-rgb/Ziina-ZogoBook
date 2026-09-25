"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  DollarSign,
  FileCheck2,
  AlertTriangle,
  AlertOctagon,
  Search,
  Calendar,
  X,
  Plus,
  Zap,
  Filter,
} from "lucide-react";
import { KpiCard, Button } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { TABS, type Tab } from "@/lib/status";
import { useI18n } from "@/lib/i18n";
import { PaymentsTable, type Row } from "./PaymentsTable";
import { ReconcileButton } from "./ReconcileButton";
import { StripeSyncButton } from "./StripeSyncButton";
import { HideTestButton } from "./HideTestButton";

interface PaymentsViewProps {
  initialTab: Tab;
  initialQ?: string;
  initialFrom?: string;
  initialTo?: string;
  counts: Record<string, { n: number; sum: number }>;
  visibleTestCount: number;
  payments: Row[];
  partners: { id: string; name: string }[];
  stripeEnabled?: boolean;
}

export function PaymentsView({
  initialTab,
  initialQ = "",
  initialFrom = "",
  initialTo = "",
  counts,
  visibleTestCount,
  stripeEnabled,
  payments,
  partners,
}: PaymentsViewProps) {
  const router = useRouter();
  const { t, lang } = useI18n();

  const [q, setQ] = useState(initialQ);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  const tab = initialTab;

  function setPresetDates(days: number | "all") {
    if (days === "all") {
      setFrom("");
      setTo("");
      submitFilters("", "");
      return;
    }

    // Calendar days in Dubai time (toISOString would give the UTC date, a day off before 04:00).
    const end = new Date();
    const start = new Date(end.getTime() - days * 86400_000);
    const fmt = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);
    const fromStr = fmt(start);
    const toStr = fmt(end);

    setFrom(fromStr);
    setTo(toStr);
    submitFilters(fromStr, toStr);
  }

  function submitFilters(fromVal = from, toVal = to, qVal = q) {
    const p = new URLSearchParams();
    p.set("tab", tab);
    if (qVal.trim()) p.set("q", qVal.trim());
    if (fromVal) p.set("from", fromVal);
    if (toVal) p.set("to", toVal);
    router.push(`/payments?${p.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    submitFilters();
  }

  function clearFilters() {
    setQ("");
    setFrom("");
    setTo("");
    router.push(`/payments?tab=${tab}`);
  }

  const hasFilters = Boolean(q || from || to);

  const getTabLabel = (key: Tab) => {
    const map: Record<Tab, string> = {
      to_invoice: t.tab_to_invoice,
      review: t.tab_review,
      invoiced: t.tab_invoiced,
      done: t.tab_done,
      pending: t.tab_pending,
      errors: t.tab_errors,
      failed: t.tab_failed,
      all: t.tab_all,
      archived: t.tab_archived,
    };
    return map[key] || key;
  };

  const qs = (tKey: string) => {
    const p = new URLSearchParams();
    p.set("tab", tKey);
    if (q) p.set("q", q);
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    return `/payments?${p.toString()}`;
  };

  // KPIs
  const totalRevenue = counts.done?.sum ?? 0;
  const toInvoiceSum = counts.to_invoice?.sum ?? 0;
  const toInvoiceCount = counts.to_invoice?.n ?? 0;
  const reviewCount = counts.review?.n ?? 0;
  const errorCount = counts.errors?.n ?? 0;

  return (
    <div className="space-y-6">
      {/* Top Header & Quick Actions */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.nav_payments}</h1>
          <p className="text-xs text-slate-500 mt-1">{t.brand_tagline}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {visibleTestCount > 0 && <HideTestButton count={visibleTestCount} />}
          {stripeEnabled && <StripeSyncButton />}
          <ReconcileButton />
          <Link href="/quick-link">
            <Button variant="secondary" size="md">
              <Zap className="h-4 w-4 text-amber-500" />
              <span>{t.quick_link_btn}</span>
            </Button>
          </Link>
          <Link href="/links/new">
            <Button variant="primary" size="md">
              <Plus className="h-4 w-4" />
              <span>{t.new_link_btn}</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Top Executive KPI Cards (Maximizing empty space) */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard
          title={t.kpi_total_revenue}
          value={formatMoney(totalRevenue, "AED")}
          subtext={`${counts.done?.n ?? 0} ${lang === "ar" ? "عملية مكتملة ومسجلة" : "completed payments"}`}
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          active={tab === "done"}
          onClick={() => router.push(qs("done"))}
        />
        <KpiCard
          title={t.kpi_to_invoice}
          value={toInvoiceCount}
          subtext={toInvoiceSum > 0 ? formatMoney(toInvoiceSum, "AED") : undefined}
          icon={<FileCheck2 className="h-5 w-5 text-brand" />}
          active={tab === "to_invoice"}
          onClick={() => router.push(qs("to_invoice"))}
        />
        <KpiCard
          title={t.kpi_needs_review}
          value={reviewCount}
          subtext={lang === "ar" ? "سجلات مطابقة محتملة في Zoho" : "Zoho matching candidates"}
          icon={<AlertTriangle className="h-5 w-5 text-amber-600" />}
          active={tab === "review"}
          onClick={() => router.push(qs("review"))}
        />
        <KpiCard
          title={t.kpi_sync_errors}
          value={errorCount}
          subtext={lang === "ar" ? "عمليات تتطلب مراجعة السبب" : "Payments failed syncing"}
          icon={<AlertOctagon className="h-5 w-5 text-rose-600" />}
          active={tab === "errors"}
          onClick={() => router.push(qs("errors"))}
        />
      </div>

      {/* Categorized Tab Badges Bar */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9">
        {TABS.map((tItem) => {
          const c = counts[tItem.key] ?? { n: 0, sum: 0 };
          const active = tItem.key === tab;
          return (
            <Link
              key={tItem.key}
              href={qs(tItem.key)}
              className={`flex flex-col justify-between rounded-2xl border p-3 text-start transition duration-150 ${
                active
                  ? "border-brand bg-brand-50/50 shadow-xs ring-2 ring-brand/20 font-bold"
                  : "border-slate-200/80 bg-white hover:border-slate-300 hover:bg-slate-50/60"
              }`}
            >
              <div className={`text-xs truncate ${active ? "text-brand font-bold" : "text-slate-500 font-medium"}`}>
                {getTabLabel(tItem.key)}
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-1">
                <span className="num text-base font-bold text-slate-900">{c.n}</span>
                {c.sum > 0 && <span className="num text-[11px] text-slate-400">{formatMoney(c.sum)}</span>}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            {/* Search Input */}
            <div className="min-w-64 flex-1">
              <label className="text-xs font-semibold text-slate-600">{t.search}</label>
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-4 w-4 text-slate-400" />
                <input
                  name="q"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder={t.search_placeholder}
                  className="ps-9"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-600">{t.date_from}</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  name="from"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="ps-9"
                />
              </div>
            </div>

            <div className="w-full sm:w-auto">
              <label className="text-xs font-semibold text-slate-600">{t.date_to}</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  name="to"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="ps-9"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button type="submit" variant="primary" size="md">
                <Filter className="h-3.5 w-3.5" />
                <span>{t.apply}</span>
              </Button>
              {hasFilters && (
                <Button type="button" variant="ghost" size="md" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" />
                  <span>{t.reset}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Quick Date Presets */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-400 font-medium">{lang === "ar" ? "فلاتر سريعة:" : "Quick Ranges:"}</span>
            <button
              type="button"
              onClick={() => setPresetDates(0)}
              className="rounded-lg px-2.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              {t.today}
            </button>
            <button
              type="button"
              onClick={() => setPresetDates(7)}
              className="rounded-lg px-2.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              {t.this_week}
            </button>
            <button
              type="button"
              onClick={() => setPresetDates(30)}
              className="rounded-lg px-2.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              {t.this_month}
            </button>
            <button
              type="button"
              onClick={() => setPresetDates("all")}
              className="rounded-lg px-2.5 py-1 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
            >
              {t.all_time}
            </button>
          </div>
        </form>
      </div>

      {/* Main Payments Table */}
      <PaymentsTable payments={payments} tab={tab} partners={partners} />
    </div>
  );
}
