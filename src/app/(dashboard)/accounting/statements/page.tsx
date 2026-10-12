"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Download, FileText, Printer } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { api } from "@/components/fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { aedToUsd, formatMoney } from "@/lib/money";
import type { StatementLine } from "@/lib/ledger-calc";

interface StatementResponse {
  account: { id: string; name: string; kind: string; key: string | null };
  accounts: { id: string; name: string; kind: string }[];
  opening: number;
  rows: (Omit<StatementLine, "date"> & { date: string })[];
  totalIn: number;
  totalOut: number;
  closing: number;
}

const L = {
  ar: {
    title: "كشف حساب",
    subtitle: "حركات أي حساب (شريك، صندوق، بنك، بوابة دفع) خلال فترة، مع الرصيد بعد كل حركة.",
    account: "الحساب",
    choose: "— اختر الحساب —",
    opening: "الرصيد الافتتاحي",
    closing: "الرصيد الختامي",
    date: "التاريخ",
    desc: "البيان",
    in: "داخل",
    out: "خارج",
    credit: "له",
    debit: "عليه / استلم",
    balance: "الرصيد",
    partnerBalance: "المتبقي له",
    total: "المجموع",
    none: "لا توجد حركات في هذه الفترة",
    print: "طباعة",
    csv: "تصدير Excel",
    period: "الفترة",
    all: "كل الفترات",
    from: "من",
    to: "إلى",
    paymentOf: "دفعة",
    gross: "إجمالي",
    fee: "عمولة",
    transferFrom: "تحويل من",
    transferTo: "تحويل إلى",
    receivedFrom: "استلم من",
    paidTo: "أودع / دفع إلى",
    transferFee: "رسوم تحويل",
    income: "إيراد آخر",
    expense: "مصروف",
    expensePaid: "مصروف دفعه من حسابه",
    bankFee: "رسوم بنكية",
    costShare: "حصته من",
    openPayment: "فتح الدفعة",
    usd: "بالدولار",
    generated: "تاريخ الكشف",
  },
  en: {
    title: "Account statement",
    subtitle: "Movements of any account (partner, box, bank, gateway) over a period, with the balance after each line.",
    account: "Account",
    choose: "— choose an account —",
    opening: "Opening balance",
    closing: "Closing balance",
    date: "Date",
    desc: "Description",
    in: "In",
    out: "Out",
    credit: "Credit (due)",
    debit: "Debit (received)",
    balance: "Balance",
    partnerBalance: "Remaining",
    total: "Total",
    none: "No movements in this period",
    print: "Print",
    csv: "Export Excel",
    period: "Period",
    all: "All time",
    from: "From",
    to: "To",
    paymentOf: "Payment",
    gross: "gross",
    fee: "fee",
    transferFrom: "Transfer from",
    transferTo: "Transfer to",
    receivedFrom: "Received from",
    paidTo: "Paid / deposited to",
    transferFee: "Transfer fee",
    income: "Other income",
    expense: "Expense",
    expensePaid: "Expense paid personally",
    bankFee: "Bank fee",
    costShare: "Share of",
    openPayment: "Open payment",
    usd: "in USD",
    generated: "Generated",
  },
};

const dubai = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" });
const num = (fils: number) => (fils / 100).toFixed(2);

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

export default function StatementsPage() {
  // useSearchParams (preselected ?account=) needs a Suspense boundary.
  return (
    <Suspense>
      <Statements />
    </Suspense>
  );
}

function Statements() {
  const { a, lang, categoryLabel, accountKindLabel } = useAcc();
  const l = L[lang];
  const sp = useSearchParams();
  const [accountId, setAccountId] = useState(sp.get("account") ?? "");
  const [preset, setPreset] = useState("all_time");
  const [[from, to], setRange] = useState<[string, string]>(["", ""]);
  const [accounts, setAccounts] = useState<{ id: string; name: string; kind: string }[]>([]);
  const [data, setData] = useState<StatementResponse | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<{ accounts: { id: string; name: string; kind: string }[] }>("/api/accounting/accounts")
      .then((r) => setAccounts(r.accounts))
      .catch((e) => setError(String(e)));
  }, []);

  const load = useCallback(async () => {
    if (!accountId) return setData(null);
    setBusy(true);
    setError("");
    try {
      const p = new URLSearchParams({ account: accountId });
      if (from) p.set("from", from);
      if (to) p.set("to", to);
      setData(await api<StatementResponse>(`/api/accounting/statement?${p}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [accountId, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const isPartner = data?.account.kind === "partner";
  const name = useCallback((id?: string) => data?.accounts.find((x) => x.id === id)?.name ?? "—", [data]);

  /** Human description of a line (also used for the CSV export). */
  const describe = useCallback(
    (r: StatementResponse["rows"][number]) => {
      switch (r.type) {
        case "sale": {
          const g = r.gateway === "stripe" ? "Stripe" : "Ziina";
          const who = [r.orderNumber ? `#${r.orderNumber}` : "", r.customerName ?? ""].filter(Boolean).join(" — ");
          return `${l.paymentOf} ${g}${who ? ` ${who}` : ""} (${l.gross} ${num(r.gross ?? 0)}، ${l.fee} ${num(r.fee ?? 0)})`;
        }
        case "transfer_in":
          return `${isPartner ? l.receivedFrom : l.transferFrom} ${name(r.counterpartId)}`;
        case "transfer_out":
          return `${isPartner ? l.paidTo : l.transferTo} ${name(r.counterpartId)}`;
        case "transfer_fee":
          return l.transferFee;
        case "income":
          return l.income;
        case "expense":
          return `${l.expense}: ${categoryLabel(r.category)}`;
        case "expense_paid":
          return `${l.expensePaid}: ${categoryLabel(r.category)}`;
        case "bank_fee":
          return l.bankFee;
        case "cost_share":
          return `${l.costShare}: ${
            r.category === "bank_fee" ? l.bankFee : r.category === "income" ? l.income : r.category === "transfer" ? l.transferFee : categoryLabel(r.category)
          }`;
      }
    },
    [l, isPartner, name, categoryLabel],
  );

  const grouped = useMemo(() => {
    const order = ["partner", "bank", "cash", "gateway"];
    return order.map((k) => ({ kind: k, items: accounts.filter((x) => x.kind === k) })).filter((g) => g.items.length);
  }, [accounts]);

  function exportCsv() {
    if (!data) return;
    const head = [l.date, l.desc, isPartner ? l.credit : l.in, isPartner ? l.debit : l.out, isPartner ? l.partnerBalance : l.balance];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines = [
      [`${l.title}: ${data.account.name}`],
      [`${l.period}: ${from || "—"} → ${to || dubai(new Date())}`],
      [],
      head,
      ["", l.opening, "", "", num(data.opening)],
      ...data.rows.map((r) => [
        dubai(new Date(r.date)),
        [describe(r), r.description, r.reference ? `#${r.reference}` : ""].filter(Boolean).join(" | "),
        r.in ? num(r.in) : "",
        r.out ? num(r.out) : "",
        num(r.balance ?? 0),
      ]),
      ["", l.total, num(data.totalIn), num(data.totalOut), ""],
      ["", l.closing, "", "", num(data.closing)],
    ];
    // BOM so Excel opens Arabic text correctly.
    const csv = "﻿" + lines.map((row) => row.map((c) => esc(String(c ?? ""))).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `statement-${data.account.name.replace(/\s+/g, "_")}-${from || "all"}-${to || dubai(new Date())}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5">
      {/* Controls (hidden when printing) */}
      <Card className="no-print space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{l.title}</h2>
            <p className="text-[11px] text-slate-500">{l.subtitle}</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[2fr_3fr]">
          <div>
            <label>{l.account}</label>
            <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">{l.choose}</option>
              {grouped.map((g) => (
                <optgroup key={g.kind} label={accountKindLabel(g.kind)}>
                  {g.items.map((x) => (
                    <option key={x.id} value={x.id}>
                      {x.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label>{l.period}</label>
            <div className="flex flex-wrap items-center gap-2">
              {["this_month", "last_month", "this_year", "all_time"].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPreset(p);
                    setRange(presetRange(p));
                  }}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
                    preset === p ? "bg-brand text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {p === "all_time" ? l.all : a[p as "this_month"]}
                </button>
              ))}
              <input
                type="date"
                value={from}
                onChange={(e) => {
                  setPreset("custom");
                  setRange([e.target.value, to]);
                }}
                className="!w-auto py-1.5 text-xs"
                aria-label={l.from}
              />
              <input
                type="date"
                value={to}
                onChange={(e) => {
                  setPreset("custom");
                  setRange([from, e.target.value]);
                }}
                className="!w-auto py-1.5 text-xs"
                aria-label={l.to}
              />
            </div>
          </div>
        </div>
        {data && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="h-3.5 w-3.5" /> {l.print}
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCsv}>
              <Download className="h-3.5 w-3.5" /> {l.csv}
            </Button>
          </div>
        )}
      </Card>

      {error && <Alert tone="error">{error}</Alert>}
      {busy && !data && <div className="text-sm text-slate-500">…</div>}

      {data && (
        <Card className="print-area space-y-4">
          {/* Statement header */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="text-xs font-semibold text-slate-400">{l.title}</div>
              <div className="text-xl font-extrabold text-slate-900">{data.account.name}</div>
              <div className="text-xs text-slate-500">
                {accountKindLabel(data.account.kind)} · {l.period}:{" "}
                <span className="num">
                  {from || "—"} → {to || dubai(new Date())}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-4">
              <Stat label={l.opening} fils={data.opening} />
              <Stat label={isPartner ? l.credit : l.in} fils={data.totalIn} tone="green" />
              <Stat label={isPartner ? l.debit : l.out} fils={-data.totalOut} tone="red" />
              <Stat label={isPartner ? l.partnerBalance : l.closing} fils={data.closing} strong />
              {isPartner && (
                <div className="col-span-2 text-[11px] text-slate-500 sm:col-span-4">
                  {l.partnerBalance} {l.usd}: <span className="num font-semibold">≈ {formatMoney(aedToUsd(data.closing), "USD")}</span>
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50/80 text-[11px] font-semibold text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-start">{l.date}</th>
                  <th className="px-3 py-2 text-start">{l.desc}</th>
                  <th className="px-3 py-2 text-end">{isPartner ? l.credit : l.in}</th>
                  <th className="px-3 py-2 text-end">{isPartner ? l.debit : l.out}</th>
                  <th className="px-3 py-2 text-end">{isPartner ? l.partnerBalance : l.balance}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-slate-50/50">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-xs font-bold text-slate-700">{l.opening}</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2" />
                  <td className="num px-3 py-2 text-end font-bold">{formatMoney(data.opening)}</td>
                </tr>
                {data.rows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-xs text-slate-400">
                      {l.none}
                    </td>
                  </tr>
                )}
                {data.rows.map((r, i) => (
                  <tr key={i} className="align-top hover:bg-slate-50/60">
                    <td className="num whitespace-nowrap px-3 py-2 text-[11px] text-slate-500">{fmtDate(r.date)}</td>
                    <td className="px-3 py-2 text-xs">
                      <div className="font-medium text-slate-800">{describe(r)}</div>
                      {(r.description || r.reference) && r.type !== "sale" && (
                        <div className="text-[11px] text-slate-400">
                          {r.description}
                          {r.reference ? <span className="num ms-1">#{r.reference}</span> : null}
                        </div>
                      )}
                      {r.paymentId && (
                        <Link href={`/payments/${r.paymentId}`} className="no-print text-[11px] text-brand hover:underline">
                          {l.openPayment}
                        </Link>
                      )}
                    </td>
                    <td className="num whitespace-nowrap px-3 py-2 text-end text-emerald-700">{r.in ? formatMoney(r.in) : ""}</td>
                    <td className="num whitespace-nowrap px-3 py-2 text-end text-rose-600">{r.out ? formatMoney(r.out) : ""}</td>
                    <td
                      className={`num whitespace-nowrap px-3 py-2 text-end font-semibold ${(r.balance ?? 0) < 0 ? "text-rose-600" : "text-slate-800"}`}
                    >
                      {formatMoney(r.balance ?? 0)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-50/80 font-bold">
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-xs">{l.total}</td>
                  <td className="num px-3 py-2 text-end text-emerald-700">{formatMoney(data.totalIn)}</td>
                  <td className="num px-3 py-2 text-end text-rose-600">{formatMoney(data.totalOut)}</td>
                  <td className={`num px-3 py-2 text-end ${data.closing < 0 ? "text-rose-600" : "text-slate-900"}`}>
                    {formatMoney(data.closing)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="num text-[10px] text-slate-400">
            {l.generated}: {new Date().toLocaleString("en-GB", { timeZone: "Asia/Dubai" })}
          </div>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, fils, tone, strong }: { label: string; fils: number; tone?: "green" | "red"; strong?: boolean }) {
  const color = tone === "green" ? "text-emerald-700" : tone === "red" ? "text-rose-600" : fils < 0 ? "text-rose-600" : "text-slate-900";
  return (
    <div>
      <div className="text-[10px] font-semibold text-slate-400">{label}</div>
      <div className={`num ${strong ? "text-base font-extrabold" : "font-bold"} ${color}`}>{formatMoney(fils)}</div>
    </div>
  );
}
