"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Banknote, Building2, CreditCard, Landmark, Receipt, TrendingUp, UserRound, Wallet } from "lucide-react";
import { Alert, Card, KpiCard } from "@/components/ui";
import { Money } from "@/components/ledger";
import { api } from "@/components/fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { formatMoney } from "@/lib/money";
import type { PartnerStatement, PeriodReport } from "@/lib/ledger-calc";

interface Summary {
  report: PeriodReport;
  balances: {
    id: string;
    key: string | null;
    name: string;
    kind: string;
    balance: number;
    statementBalanceFils: number | null;
    statementDate: string | null;
  }[];
  statements: { partners: PartnerStatement[]; unassigned: { count: number; net: number } };
}

const dubai = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);

/** [from, to] as yyyy-mm-dd in Dubai time for a preset. */
function presetRange(p: string): [string, string] {
  const today = dubai(new Date());
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = (yy: number, mm: number) => new Date(Date.UTC(yy, mm, 0)).getUTCDate();
  if (p === "this_month") return [`${y}-${pad(m)}-01`, today];
  if (p === "last_month") {
    const yy = m === 1 ? y - 1 : y;
    const mm = m === 1 ? 12 : m - 1;
    return [`${yy}-${pad(mm)}-01`, `${yy}-${pad(mm)}-${pad(lastDay(yy, mm))}`];
  }
  if (p === "this_year") return [`${y}-01-01`, today];
  return ["", ""];
}

const ICONS: Record<string, React.ReactNode> = {
  gateway: <CreditCard className="h-4 w-4" />,
  bank: <Landmark className="h-4 w-4" />,
  partner: <UserRound className="h-4 w-4" />,
};

export default function AccountingOverview() {
  const { a, categoryLabel, accountKindLabel } = useAcc();
  const [preset, setPreset] = useState("this_month");
  const [[from, to], setRange] = useState<[string, string]>(presetRange("this_month"));
  const [data, setData] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const p = new URLSearchParams();
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      setData(await api<Summary>(`/api/accounting/summary?${p}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = (p: string) => {
    setPreset(p);
    setRange(presetRange(p));
  };

  const r = data?.report;

  return (
    <div className="space-y-6">
      {/* Period */}
      <Card className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap gap-1.5">
          {["this_month", "last_month", "this_year", "all_time"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => choose(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                preset === p ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {a[p as "this_month"]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label>{a.from}</label>
            <input
              type="date"
              value={from}
              onChange={(e) => {
                setPreset("custom");
                setRange([e.target.value, to]);
              }}
            />
          </div>
          <div>
            <label>{a.to}</label>
            <input
              type="date"
              value={to}
              onChange={(e) => {
                setPreset("custom");
                setRange([from, e.target.value]);
              }}
            />
          </div>
        </div>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && <div className="text-sm text-slate-500">…</div>}

      {r && data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <KpiCard
              title={a.sales}
              value={formatMoney(r.sales)}
              subtext={`${r.salesCount} ${a.payments_n}`}
              icon={<Wallet className="h-5 w-5 text-emerald-600" />}
            />
            <KpiCard title={a.gateway_fees} value={formatMoney(r.gatewayFees)} icon={<CreditCard className="h-5 w-5 text-purple-600" />} />
            <KpiCard title={a.bank_fees} value={formatMoney(r.bankFees)} icon={<Landmark className="h-5 w-5 text-sky-600" />} />
            <KpiCard title={a.expenses} value={formatMoney(r.expenses)} icon={<Receipt className="h-5 w-5 text-amber-600" />} />
            <KpiCard
              title={a.net_profit}
              value={<span className={r.netProfit < 0 ? "text-rose-600" : "text-emerald-700"}>{formatMoney(r.netProfit)}</span>}
              subtext={r.otherIncome ? `${a.other_income}: ${formatMoney(r.otherIncome)}` : undefined}
              icon={<TrendingUp className="h-5 w-5 text-brand" />}
            />
          </div>

          {/* Partner statements */}
          <section className="space-y-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{a.partners_title}</h2>
              <p className="text-xs text-slate-500">{a.partners_hint}</p>
            </div>
            {data.statements.unassigned.count > 0 && (
              <Alert tone="warning">
                <b>
                  {a.unassigned_title}: <span className="num">{data.statements.unassigned.count}</span> (
                  <span className="num">{formatMoney(data.statements.unassigned.net)}</span>)
                </b>{" "}
                — {a.unassigned_desc}{" "}
                <Link href="/payments?tab=all" className="font-semibold underline">
                  {a.go_assign}
                </Link>
              </Alert>
            )}
            <div className="grid gap-4 md:grid-cols-2">
              {data.statements.partners.map((p) => (
                <Card key={p.accountId} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand">
                        <UserRound className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="num text-xs text-slate-400">
                          {p.paymentsCount} {a.payments_n}
                        </div>
                      </div>
                    </div>
                    <div className="text-end">
                      <div className="text-[11px] text-slate-500">{a.remaining}</div>
                      <div className="text-lg">
                        <Money fils={p.remaining} strong signColor />
                      </div>
                      <div className={`text-[11px] font-semibold ${p.remaining < 0 ? "text-rose-600" : "text-slate-400"}`}>
                        {p.remaining < 0 ? a.over_received : p.remaining === 0 ? a.settled : ""}
                      </div>
                    </div>
                  </div>
                  <dl className="space-y-1.5 border-t border-slate-100 pt-3 text-sm">
                    <Row label={a.from_payments} fils={p.entitledFromPayments} />
                    {p.expensesPaid > 0 && <Row label={a.expenses_paid} fils={p.expensesPaid} />}
                    {p.paidIn > 0 && <Row label={a.paid_in} fils={p.paidIn} />}
                    <Row label={a.total_due} fils={p.due} strong />
                    <Row label={a.received} fils={-p.received} />
                    <div className="flex justify-between border-t border-dashed border-slate-200 pt-1.5">
                      <dt className="font-bold text-slate-800">{a.remaining}</dt>
                      <dd>
                        <Money fils={p.remaining} strong signColor />
                      </dd>
                    </div>
                  </dl>
                </Card>
              ))}
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Balances */}
            <Card className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Building2 className="h-4 w-4 text-slate-500" /> {a.balances_title}
              </h2>
              <ul className="divide-y divide-slate-100">
                {data.balances.map((b) => {
                  const diff = b.statementBalanceFils != null ? b.balance - b.statementBalanceFils : null;
                  return (
                    <li key={b.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{ICONS[b.kind]}</span>
                        <div>
                          <div className="font-semibold text-slate-800">{b.name}</div>
                          <div className="text-[11px] text-slate-400">{accountKindLabel(b.kind)}</div>
                        </div>
                      </div>
                      <div className="text-end">
                        <Money fils={b.balance} strong signColor={b.kind === "partner"} />
                        {diff !== null && (
                          <div className="text-[11px] text-slate-500">
                            {a.statement_balance}: <span className="num">{formatMoney(b.statementBalanceFils!)}</span>
                            {" · "}
                            {diff === 0 ? (
                              <span className="text-emerald-600">{a.matches_statement}</span>
                            ) : (
                              <span className="text-rose-600">
                                {a.difference}: <span className="num">{formatMoney(diff)}</span>
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
                <span className="flex items-center gap-1.5">
                  <Banknote className="h-3.5 w-3.5" /> {a.withdrawals}
                </span>
                <Money fils={r.gatewayWithdrawals} strong />
              </div>
            </Card>

            {/* Expenses by category */}
            <Card className="space-y-3">
              <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Receipt className="h-4 w-4 text-slate-500" /> {a.expenses_by_cat}
              </h2>
              {r.expensesByCategory.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-400">{a.no_expenses}</div>
              ) : (
                <ul className="space-y-2">
                  {r.expensesByCategory.map((c) => (
                    <li key={c.category} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-700">{categoryLabel(c.category)}</span>
                        <Money fils={c.amount} />
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.round((c.amount / r.expenses) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, fils, strong }: { label: string; fils: number; strong?: boolean }) {
  return (
    <div className="flex justify-between">
      <dt className={strong ? "font-semibold text-slate-800" : "text-slate-500"}>{label}</dt>
      <dd>
        <Money fils={fils} strong={strong} />
      </dd>
    </div>
  );
}
