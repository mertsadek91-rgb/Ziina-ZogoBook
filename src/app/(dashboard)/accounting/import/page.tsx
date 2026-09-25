"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import { Upload } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { Money, useAccounts } from "@/components/ledger";
import { api } from "@/components/fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { EXPENSE_CATEGORIES } from "@/lib/ledger-calc";
import { guessColumns, parseStatement, suggestBooking, type BankLine, type ColumnKey, type ColumnMap } from "@/lib/bank-csv";
import { formatMoney } from "@/lib/money";

interface Row extends BankLine {
  kind: "transfer" | "expense" | "bank_fee" | "income" | "skip";
  fromAccountId?: string;
  toAccountId?: string;
  category?: string;
}

const COLS: ColumnKey[] = ["date", "description", "amount", "debit", "credit", "balance", "reference"];

export default function ImportBankPage() {
  const { a, lang, kindLabel } = useAcc();
  const { accounts, error: accountsError } = useAccounts();
  const banks = accounts.filter((x) => x.kind === "bank");
  const partners = accounts.filter((x) => x.kind === "partner");
  const gateway = accounts.find((x) => x.key === "ziina") ?? accounts.find((x) => x.kind === "gateway");

  const [bankId, setBankId] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<ColumnMap>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (!bankId && banks.length) setBankId((banks.find((b) => b.key === "wio") ?? banks[0]).id);
  }, [banks, bankId]);

  const parsed = useMemo(() => (records.length ? parseStatement(records, map) : null), [records, map]);
  const amountReady = Boolean(map.amount || map.debit || map.credit);

  // Re-suggest bookings whenever the parsed lines or the bank change.
  useEffect(() => {
    if (!parsed || !bankId) return setRows([]);
    const ctx = { bankAccountId: bankId, gatewayAccountId: gateway?.id, partners: partners.map((p) => ({ id: p.id, name: p.name })) };
    setRows(parsed.lines.map((l) => ({ ...l, ...suggestBooking(l, ctx) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, bankId, accounts.length]);

  function onFile(file: File) {
    setMsg(null);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = (res.meta.fields ?? []).filter(Boolean);
        setHeaders(hs);
        setMap(guessColumns(hs));
        setRecords(res.data);
      },
    });
  }

  function update(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  /** Changing the type re-derives the accounts from the line's direction. */
  function changeKind(i: number, kind: Row["kind"]) {
    const r = rows[i];
    const incoming = r.amountFils > 0;
    if (kind === "transfer") {
      update(i, incoming ? { kind, fromAccountId: gateway?.id, toAccountId: bankId } : { kind, fromAccountId: bankId, toAccountId: partners[0]?.id });
    } else if (kind === "income") update(i, { kind, fromAccountId: undefined, toAccountId: bankId });
    else if (kind === "skip") update(i, { kind });
    else update(i, { kind, fromAccountId: bankId, toAccountId: undefined, category: kind === "expense" ? r.category ?? "other" : undefined });
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{ created: number; duplicates: number; skipped: number; errors: string[] }>("/api/accounting/import", {
        body: {
          bankAccountId: bankId,
          closingBalanceFils: parsed?.closingBalanceFils,
          closingDate: parsed?.closingDate,
          lines: rows.map((r) => ({
            date: r.date,
            kind: r.kind,
            amountFils: Math.abs(r.amountFils),
            fromAccountId: r.fromAccountId,
            toAccountId: r.toAccountId,
            category: r.category,
            description: r.description,
            reference: r.reference,
            externalId: r.externalId,
          })),
        },
      });
      setMsg({
        tone: res.errors.length ? "error" : "success",
        text: a.import_result(res.created, res.duplicates, res.skipped) + (res.errors.length ? " " + res.errors.join(" | ") : ""),
      });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  const totalIn = rows.filter((r) => r.amountFils > 0).reduce((s, r) => s + r.amountFils, 0);
  const totalOut = rows.filter((r) => r.amountFils < 0).reduce((s, r) => s - r.amountFils, 0);
  const acctName = (id?: string) => accounts.find((x) => x.id === id)?.name ?? "—";

  return (
    <div className="space-y-4">
      <Card className="space-y-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{a.import_title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{a.import_desc}</p>
        </div>
        {accountsError && <Alert tone="error">{accountsError}</Alert>}
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label>{a.bank_account}</label>
            <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>CSV</label>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm font-normal text-slate-600 hover:bg-slate-100">
              <Upload className="h-4 w-4" />
              <span>{records.length ? `${records.length} ${a.lines}` : "…"}</span>
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          </div>
        </div>

        {headers.length > 0 && (
          <div className="space-y-2">
            <div className="text-xs font-semibold text-slate-700">{a.columns}</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {COLS.map((c) => (
                <div key={c}>
                  <label>{a[`col_${c}` as "col_date"]}</label>
                  <select value={map[c] ?? ""} onChange={(e) => setMap({ ...map, [c]: e.target.value || undefined })}>
                    <option value="">{a.ignore}</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            {!amountReady && <Alert tone="warning">{a.need_amount_cols}</Alert>}
            {parsed && parsed.problems.length > 0 && <Alert tone="warning">{parsed.problems.slice(0, 8).join(" | ")}</Alert>}
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900">
              {a.preview}: <span className="num">{rows.length}</span> {a.lines}
            </h3>
            <div className="flex flex-wrap gap-3 text-xs text-slate-600">
              <span>
                {a.money_in}: <span className="num font-semibold text-emerald-700">{formatMoney(totalIn)}</span>
              </span>
              <span>
                {a.money_out}: <span className="num font-semibold text-rose-600">{formatMoney(totalOut)}</span>
              </span>
              {parsed?.closingBalanceFils != null && (
                <span>
                  {a.closing_balance}: <span className="num font-semibold">{formatMoney(parsed.closingBalanceFils)}</span>
                </span>
              )}
            </div>
          </div>
          <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
                <tr>
                  <th className="p-2 text-start">{a.date}</th>
                  <th className="p-2 text-start">{a.description}</th>
                  <th className="p-2 text-end">{a.amount}</th>
                  <th className="p-2 text-start">{a.kind}</th>
                  <th className="p-2 text-start">{a.from_account} / {a.to_account} / {a.category}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.externalId} className={`border-t border-slate-100 ${r.kind === "skip" ? "opacity-40" : ""}`}>
                    <td className="num whitespace-nowrap p-2">{new Date(r.date).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" })}</td>
                    <td className="max-w-72 p-2">
                      <div className="truncate" title={r.description}>
                        {r.description}
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-2 text-end">
                      <Money fils={r.amountFils} strong signColor />
                    </td>
                    <td className="p-2">
                      <select className="!py-1 !px-2 !text-xs !rounded-lg" value={r.kind} onChange={(e) => changeKind(i, e.target.value as Row["kind"])}>
                        {(["transfer", "expense", "bank_fee", "income", "skip"] as const)
                          .filter((k) => (r.amountFils > 0 ? k !== "expense" && k !== "bank_fee" : k !== "income"))
                          .map((k) => (
                            <option key={k} value={k}>
                              {kindLabel(k)}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="p-2">
                      {r.kind === "transfer" && (
                        <select
                          className="!py-1 !px-2 !text-xs !rounded-lg"
                          // The bank is fixed on one side; choose the other side of the transfer.
                          value={r.amountFils > 0 ? r.fromAccountId ?? "" : r.toAccountId ?? ""}
                          onChange={(e) => update(i, r.amountFils > 0 ? { fromAccountId: e.target.value } : { toAccountId: e.target.value })}
                        >
                          {accounts
                            .filter((x) => x.id !== bankId)
                            .map((x) => (
                              <option key={x.id} value={x.id}>
                                {r.amountFils > 0 ? `${x.name} → ${acctName(bankId)}` : `${acctName(bankId)} → ${x.name}`}
                              </option>
                            ))}
                        </select>
                      )}
                      {r.kind === "expense" && (
                        <select className="!py-1 !px-2 !text-xs !rounded-lg" value={r.category ?? "other"} onChange={(e) => update(i, { category: e.target.value })}>
                          {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c[lang]}
                            </option>
                          ))}
                        </select>
                      )}
                      {(r.kind === "bank_fee" || r.kind === "income") && <span className="text-slate-400">{acctName(bankId)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button loading={busy} disabled={!bankId || !amountReady} onClick={submit}>
            {a.import_btn} (<span className="num">{rows.filter((r) => r.kind !== "skip").length}</span>)
          </Button>
        </Card>
      )}
    </div>
  );
}
