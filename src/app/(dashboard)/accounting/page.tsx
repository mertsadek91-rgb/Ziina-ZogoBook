"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Banknote,
  Building2,
  CreditCard,
  Landmark,
  Receipt,
  TrendingUp,
  UserRound,
  Wallet,
  Calendar,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Alert, Card, KpiCard, Badge } from "@/components/ui";
import { Money } from "@/components/ledger";
import { api } from "@/components/fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { formatMoney, aedToUsd } from "@/lib/money";
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
  gateway: <CreditCard className="h-4 w-4 text-purple-600" />,
  bank: <Landmark className="h-4 w-4 text-sky-600" />,
  partner: <UserRound className="h-4 w-4 text-brand" />,
};

const CAT_GRADIENTS: Record<string, string> = {
  ads: "from-blue-500 to-indigo-600",
  subscriptions: "from-purple-500 to-violet-600",
  services: "from-sky-400 to-cyan-500",
  salaries: "from-emerald-400 to-teal-500",
  office: "from-amber-400 to-orange-500",
  government: "from-slate-500 to-slate-700",
  refunds: "from-rose-400 to-red-500",
  other: "from-slate-400 to-slate-500",
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
      {/* Date Period Filter Bar */}
      <Card className="flex flex-wrap items-center justify-between gap-4">
        {/* Presets Button Group */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-1">
          {["this_month", "last_month", "this_year", "all_time"].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => choose(p)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all duration-150 ${
                preset === p
                  ? "bg-white text-slate-900 shadow-xs border border-slate-200/60"
                  : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
              }`}
            >
              {a[p as "this_month"]}
            </button>
          ))}
        </div>

        {/* Custom Range Inputs */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">{a.from}:</span>
            <div className="relative">
              <Calendar className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setPreset("custom");
                  setRange([e.target.value, to]);
                }}
                className="ps-8 py-1.5 text-xs font-medium w-auto"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500">{a.to}:</span>
            <div className="relative">
              <Calendar className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setPreset("custom");
                  setRange([from, e.target.value]);
                }}
                className="ps-8 py-1.5 text-xs font-medium w-auto"
              />
            </div>
          </div>
        </div>
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {!data && !error && (
        <div className="flex h-32 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
        </div>
      )}

      {r && data && (
        <>
          {/* Top Financial Executive KPIs */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <KpiCard
              title={a.sales}
              value={formatMoney(r.sales)}
              subtext={
                r.salesByGateway.length > 1
                  ? r.salesByGateway.map((g) => `${g.gateway === "stripe" ? "Stripe" : "Ziina"} ${formatMoney(g.sales)}`).join(" · ")
                  : `${r.salesCount} ${a.payments_n}`
              }
              icon={<Wallet className="h-5 w-5 text-emerald-600" />}
            />
            <KpiCard
              title={a.gateway_fees}
              value={formatMoney(r.gatewayFees)}
              subtext={
                r.salesByGateway.length > 1
                  ? r.salesByGateway.map((g) => `${g.gateway === "stripe" ? "Stripe" : "Ziina"} ${formatMoney(g.fees)}`).join(" · ")
                  : undefined
              }
              icon={<CreditCard className="h-5 w-5 text-purple-600" />}
            />
            <KpiCard
              title={a.bank_fees}
              value={formatMoney(r.bankFees)}
              icon={<Landmark className="h-5 w-5 text-sky-600" />}
            />
            <KpiCard
              title={a.expenses}
              value={formatMoney(r.expenses)}
              icon={<Receipt className="h-5 w-5 text-amber-600" />}
            />
            <KpiCard
              title={a.net_profit}
              className="col-span-2 sm:col-span-1 lg:col-span-1 bg-gradient-to-br from-white to-brand-50/30"
              value={
                <span className={r.netProfit < 0 ? "text-rose-600" : "text-emerald-700"}>
                  {formatMoney(r.netProfit)}
                </span>
              }
              subtext={r.otherIncome ? `${a.other_income}: ${formatMoney(r.otherIncome)}` : undefined}
              icon={<TrendingUp className="h-5 w-5 text-brand" />}
            />
          </div>

          {/* Per-gateway breakdown */}
          {r.salesByGateway.length > 0 && (
            <Card className="overflow-hidden p-0">
              <div className="border-b border-slate-100 px-5 py-3 text-sm font-bold text-slate-900">{a.by_gateway_title}</div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead className="bg-slate-50/80 text-xs font-semibold text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5 text-start">{a.gateway}</th>
                      <th className="px-5 py-2.5 text-end">{a.payments_n}</th>
                      <th className="px-5 py-2.5 text-end">{a.sales}</th>
                      <th className="px-5 py-2.5 text-end">{a.gateway_fees}</th>
                      <th className="px-5 py-2.5 text-end">{a.fee_rate}</th>
                      <th className="px-5 py-2.5 text-end">{a.net_after_fees}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {r.salesByGateway.map((g) => (
                      <tr key={g.gateway}>
                        <td className="px-5 py-2.5 font-semibold text-slate-800">{g.gateway === "stripe" ? "Stripe" : "Ziina"}</td>
                        <td className="num px-5 py-2.5 text-end text-slate-600">{g.count}</td>
                        <td className="num px-5 py-2.5 text-end">{formatMoney(g.sales)}</td>
                        <td className="num px-5 py-2.5 text-end text-rose-600">{formatMoney(g.fees)}</td>
                        <td className="num px-5 py-2.5 text-end text-slate-600">
                          {g.sales ? `${((g.fees / g.sales) * 100).toFixed(2)}%` : "—"}
                        </td>
                        <td className="num px-5 py-2.5 text-end font-bold text-emerald-700">{formatMoney(g.sales - g.fees)}</td>
                      </tr>
                    ))}
                    {r.salesByGateway.length > 1 && (
                      <tr className="bg-slate-50/60 font-bold">
                        <td className="px-5 py-2.5 text-slate-900">∑</td>
                        <td className="num px-5 py-2.5 text-end">{r.salesCount}</td>
                        <td className="num px-5 py-2.5 text-end">{formatMoney(r.sales)}</td>
                        <td className="num px-5 py-2.5 text-end text-rose-600">{formatMoney(r.gatewayFees)}</td>
                        <td className="num px-5 py-2.5 text-end">{r.sales ? `${((r.gatewayFees / r.sales) * 100).toFixed(2)}%` : "—"}</td>
                        <td className="num px-5 py-2.5 text-end text-emerald-700">{formatMoney(r.netReceived)}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {/* Partner Statements Section */}
          <section className="space-y-3.5">
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-slate-900">{a.partners_title}</h2>
              <p className="text-xs text-slate-500">{a.partners_hint}</p>
              <p className="text-[11px] text-slate-400">{a.cost_share_hint}</p>
            </div>

            {data.statements.unassigned.count > 0 && (
              <Alert tone="warning">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <b>
                      {a.unassigned_title}: <span className="num">{data.statements.unassigned.count}</span> (
                      <span className="num">{formatMoney(data.statements.unassigned.net)}</span>)
                    </b>{" "}
                    — {a.unassigned_desc}
                  </div>
                  <Link
                    href="/payments?tab=all"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100/90 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-200 transition"
                  >
                    <span>{a.go_assign}</span>
                    <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" />
                  </Link>
                </div>
              </Alert>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              {data.statements.partners.map((p) => {
                const isSettled = p.remaining === 0;
                const isOverpaid = p.remaining < 0;

                return (
                  <Card key={p.accountId} className="space-y-4 hover:border-slate-300 transition duration-150">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-50 to-brand-100 text-brand font-bold text-base shadow-2xs">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-extrabold text-slate-900 text-base">{p.name}</div>
                          <div className="num text-xs text-slate-400 mt-0.5">
                            {p.paymentsCount} {a.payments_n}
                          </div>
                        </div>
                      </div>

                      <div className="text-end">
                        <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{a.remaining}</div>
                        <div className="text-lg font-extrabold">
                          <Money fils={p.remaining} strong signColor />
                        </div>
                        <div className={`num text-xs font-semibold ${p.remaining < 0 ? "text-rose-500" : "text-slate-500"}`}>
                          ≈ {formatMoney(aedToUsd(p.remaining), "USD")}
                        </div>
                        <div className="mt-1">
                          {isSettled ? (
                            <Badge tone="green" dot>
                              {a.settled}
                            </Badge>
                          ) : isOverpaid ? (
                            <Badge tone="red" dot>
                              {a.over_received}
                            </Badge>
                          ) : (
                            <Badge tone="yellow" dot>
                              {a.remaining}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <dl className="space-y-2 border-t border-slate-100 pt-3 text-xs">
                      <Row label={a.from_payments} fils={p.entitledFromPayments} />
                      {p.expensesPaid > 0 && <Row label={a.expenses_paid} fils={p.expensesPaid} />}
                      {p.paidIn > 0 && <Row label={a.paid_in} fils={p.paidIn} />}
                      {p.costShare !== 0 && <Row label={a.cost_share} fils={-p.costShare} />}
                      <Row label={a.total_due} fils={p.due} strong />
                      <Row label={a.received} fils={-p.received} />
                      <div className="flex items-center justify-between border-t border-dashed border-slate-200 pt-2 text-sm">
                        <dt className="font-bold text-slate-900">{a.remaining}</dt>
                        <dd>
                          <Money fils={p.remaining} strong signColor />
                        </dd>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <dt className="font-semibold text-slate-700" title={a.usd_rate_hint}>
                          {a.remaining_usd}
                          <span className="ms-1 text-[10px] font-normal text-slate-400">({a.usd_rate_hint})</span>
                        </dt>
                        <dd className={`num font-bold ${p.remaining < 0 ? "text-rose-600" : p.remaining > 0 ? "text-emerald-700" : "text-slate-500"}`}>
                          {formatMoney(aedToUsd(p.remaining), "USD")}
                        </dd>
                      </div>
                    </dl>
                  </Card>
                );
              })}
            </div>
          </section>

          {/* Balances and Expenses by Category Grid */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Account Balances Card */}
            <Card className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Building2 className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">{a.balances_title}</h2>
              </div>

              <ul className="divide-y divide-slate-100">
                {data.balances.map((b) => {
                  const diff = b.statementBalanceFils != null ? b.balance - b.statementBalanceFils : null;
                  return (
                    <li key={b.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 shadow-2xs">
                          {ICONS[b.kind]}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{b.name}</div>
                          <div className="text-[11px] text-slate-400 font-medium">{accountKindLabel(b.kind)}</div>
                        </div>
                      </div>

                      <div className="text-end">
                        <Money fils={b.balance} strong signColor={b.kind === "partner"} />
                        {diff !== null && (
                          <div className="mt-0.5 text-[11px] text-slate-500 flex items-center justify-end gap-1">
                            <span>{a.statement_balance}:</span>
                            <span className="num font-semibold">{formatMoney(b.statementBalanceFils!)}</span>
                            <span>·</span>
                            {diff === 0 ? (
                              <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600">
                                <CheckCircle2 className="h-3 w-3" />
                                {a.matches_statement}
                              </span>
                            ) : (
                              <span className="font-bold text-rose-600">
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

              <div className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50/80 p-3 text-xs text-slate-600">
                {r.withdrawalsByGateway.map((w) => (
                  <div key={w.accountId} className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold">
                      <Banknote className="h-4 w-4 text-slate-500" /> {a.withdrawn_from} {w.name} {a.to_bank}
                    </span>
                    <Money fils={w.amount} strong />
                  </div>
                ))}
                {r.withdrawalsByGateway.length > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 pt-1.5 font-bold text-slate-800">
                    <span>{a.withdrawals}</span>
                    <Money fils={r.gatewayWithdrawals} strong />
                  </div>
                )}
              </div>
            </Card>

            {/* Expenses by Category Card */}
            <Card className="space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
                <Receipt className="h-4 w-4 text-slate-500" />
                <h2 className="text-sm font-bold text-slate-900">{a.expenses_by_cat}</h2>
              </div>

              {r.expensesByCategory.length === 0 ? (
                <div className="py-12 text-center text-xs text-slate-400 font-medium">{a.no_expenses}</div>
              ) : (
                <ul className="space-y-3">
                  {r.expensesByCategory.map((c) => {
                    const pct = r.expenses > 0 ? Math.round((c.amount / r.expenses) * 100) : 0;
                    return (
                      <li key={c.category} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{categoryLabel(c.category)}</span>
                          <div className="flex items-center gap-2">
                            <span className="num text-slate-400 font-medium">{pct}%</span>
                            <Money fils={c.amount} strong />
                          </div>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${CAT_GRADIENTS[c.category] || "from-amber-400 to-amber-500"} transition-all duration-300`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
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
    <div className="flex items-center justify-between">
      <dt className={strong ? "font-bold text-slate-800" : "text-slate-500 font-medium"}>{label}</dt>
      <dd>
        <Money fils={fils} strong={strong} />
      </dd>
    </div>
  );
}
