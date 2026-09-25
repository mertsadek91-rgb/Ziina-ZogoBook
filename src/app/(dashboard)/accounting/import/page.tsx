"use client";

import { useEffect, useMemo, useState } from "react";
import Papa from "papaparse";
import {
  UploadCloud,
  FileCheck,
  Landmark,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
} from "lucide-react";
import { Alert, Button, Card, Badge } from "@/components/ui";
import { Money, useAccounts } from "@/components/ledger";
import { api } from "@/components/fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { EXPENSE_CATEGORIES } from "@/lib/ledger-calc";
import {
  guessColumns,
  lineText,
  parseStatement,
  suggestBooking,
  type BankLine,
  type ColumnKey,
  type ColumnMap,
} from "@/lib/bank-csv";
import { formatMoney } from "@/lib/money";

interface Row extends BankLine {
  kind: "transfer" | "expense" | "bank_fee" | "income" | "skip";
  fromAccountId?: string;
  toAccountId?: string;
  category?: string;
}

const COLS: ColumnKey[] = ["date", "description", "amount", "debit", "credit", "balance", "reference", "notes", "type"];

export default function ImportBankPage() {
  const { a, lang, kindLabel } = useAcc();
  const { accounts, error: accountsError } = useAccounts();
  const banks = accounts.filter((x) => x.kind === "bank");
  const partners = accounts.filter((x) => x.kind === "partner");
  const gateway = accounts.find((x) => x.key === "ziina") ?? accounts.find((x) => x.kind === "gateway");

  const [bankId, setBankId] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [map, setMap] = useState<ColumnMap>({});
  const [rows, setRows] = useState<Row[]>([]);
  const [isDragging, setIsDragging] = useState(false);
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
    const ctx = {
      bankAccountId: bankId,
      gatewayAccountId: gateway?.id,
      partners: partners.map((p) => ({ id: p.id, name: p.name })),
    };
    setRows(parsed.lines.map((l) => ({ ...l, ...suggestBooking(l, ctx) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, bankId, accounts.length]);

  function onFile(file: File) {
    setFileName(file.name);
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
      update(
        i,
        incoming
          ? { kind, fromAccountId: gateway?.id, toAccountId: bankId }
          : { kind, fromAccountId: bankId, toAccountId: partners[0]?.id },
      );
    } else if (kind === "income") update(i, { kind, fromAccountId: undefined, toAccountId: bankId });
    else if (kind === "skip") update(i, { kind });
    else
      update(i, {
        kind,
        fromAccountId: bankId,
        toAccountId: undefined,
        category: kind === "expense" ? r.category ?? "other" : undefined,
      });
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await api<{ created: number; duplicates: number; skipped: number; errors: string[] }>(
        "/api/accounting/import",
        {
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
              description: lineText(r),
              reference: r.reference,
              externalId: r.externalId,
            })),
          },
        },
      );
      setMsg({
        tone: res.errors.length ? "error" : "success",
        text: `${a.import_result(res.created, res.duplicates, res.skipped)}${
          res.errors.length ? ` — ${res.errors.join(" | ")}` : ""
        }`,
      });
      setRecords([]);
      setHeaders([]);
      setRows([]);
      setFileName("");
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
    <div className="space-y-6">
      <Card className="space-y-5">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700 font-bold">
            <Landmark className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900">{a.import_title}</h2>
            <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{a.import_desc}</p>
          </div>
        </div>

        {accountsError && <Alert tone="error">{accountsError}</Alert>}
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="text-xs font-semibold text-slate-700">{a.bank_account}</label>
            <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
              {banks.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">CSV Statement</label>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) onFile(file);
              }}
              className={`group flex cursor-pointer items-center justify-between rounded-xl border-2 border-dashed px-4 py-2.5 text-xs font-medium transition duration-150 ${
                isDragging
                  ? "border-brand bg-brand-50/50 ring-2 ring-brand/20 scale-[1.01]"
                  : "border-slate-200 bg-slate-50/60 text-slate-600 hover:border-brand hover:bg-brand-50/20"
              }`}
            >
              <div className="flex items-center gap-2">
                <UploadCloud className={`h-4 w-4 transition ${isDragging ? "text-brand animate-bounce" : "text-slate-400 group-hover:text-brand"}`} />
                <span>
                  {records.length
                    ? `${records.length} ${a.lines}`
                    : lang === "ar"
                      ? "اسحب أو اختر ملف كشف الحساب (.csv)"
                      : "Drag & drop or choose CSV file"}
                </span>
              </div>
              {fileName && (
                <span className="inline-flex items-center gap-1 rounded bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs border">
                  <FileCheck className="h-3 w-3 text-emerald-600" />
                  {fileName}
                </span>
              )}
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
            </label>
          </div>
        </div>

        {headers.length > 0 && (
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">{a.columns}</div>
              {amountReady && (
                <Badge tone="green" dot>
                  {lang === "ar" ? "الأعمدة جاهزة" : "Columns ready"}
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {COLS.map((c) => {
                const isMapped = Boolean(map[c]);
                return (
                  <div
                    key={c}
                    className={`rounded-xl border p-2.5 space-y-1 transition duration-150 ${
                      isMapped ? "border-slate-300 bg-white shadow-2xs" : "border-slate-100 bg-slate-50/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] text-slate-600 mb-0">{a[`col_${c}` as "col_date"]}</label>
                      {isMapped && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" title="Mapped" />}
                    </div>
                    <select
                      value={map[c] ?? ""}
                      onChange={(e) => setMap({ ...map, [c]: e.target.value || undefined })}
                      className="py-1 px-2 text-xs bg-white"
                    >
                      <option value="">{a.ignore}</option>
                      {headers.map((h) => (
                        <option key={h} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            {!amountReady && <Alert tone="warning">{a.need_amount_cols}</Alert>}
            {parsed && parsed.problems.length > 0 && (
              <Alert tone="warning">{parsed.problems.slice(0, 8).join(" | ")}</Alert>
            )}
          </div>
        )}
      </Card>

      {rows.length > 0 && (
        <Card className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-brand" />
              <h3 className="text-sm font-bold text-slate-900">
                {a.preview}: <span className="num font-bold text-brand">{rows.length}</span> {a.lines}
              </h3>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800 border border-emerald-200">
                {a.money_in}: <span className="num">{formatMoney(totalIn)}</span>
              </span>
              <span className="rounded-lg bg-rose-50 px-2.5 py-1 font-semibold text-rose-800 border border-rose-200">
                {a.money_out}: <span className="num">{formatMoney(totalOut)}</span>
              </span>
              {parsed?.openingBalanceFils != null && (
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  {a.opening_balance_stmt}: <span className="num">{formatMoney(parsed.openingBalanceFils)}</span>
                </span>
              )}
              {parsed?.closingBalanceFils != null && (
                <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-semibold text-slate-700">
                  {a.closing_balance}: <span className="num">{formatMoney(parsed.closingBalanceFils)}</span>
                </span>
              )}
            </div>
          </div>

          <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[860px] text-xs">
              <thead className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200/80 font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-start">{a.date}</th>
                  <th className="p-3 text-start">{a.description}</th>
                  <th className="p-3 text-end">{a.amount}</th>
                  <th className="p-3 text-start">{a.kind}</th>
                  <th className="p-3 text-start">{a.from_account} / {a.to_account} / {a.category}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={r.externalId} className={`transition duration-100 hover:bg-slate-50/70 ${r.kind === "skip" ? "opacity-35" : ""}`}>
                    <td className="num whitespace-nowrap p-3 font-medium text-slate-500">
                      {new Date(r.date).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" })}
                    </td>
                    <td className="max-w-72 p-3">
                      <div className="truncate font-bold text-slate-900" title={r.description}>
                        {r.description}
                      </div>
                      {r.notes && (
                        <div className="truncate text-[10px] text-slate-400 mt-0.5" title={r.notes}>
                          {r.notes}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap p-3 text-end">
                      <Money fils={r.amountFils} strong signColor />
                    </td>
                    <td className="p-3">
                      <select
                        className="py-1 px-2 text-xs font-semibold rounded-lg"
                        value={r.kind}
                        onChange={(e) => changeKind(i, e.target.value as Row["kind"])}
                      >
                        {(["transfer", "expense", "bank_fee", "income", "skip"] as const)
                          .filter((k) => (r.amountFils > 0 ? k !== "expense" && k !== "bank_fee" : k !== "income"))
                          .map((k) => (
                            <option key={k} value={k}>
                              {kindLabel(k)}
                            </option>
                          ))}
                      </select>
                    </td>
                    <td className="p-3">
                      {r.kind === "transfer" && (
                        <select
                          className="py-1 px-2 text-xs font-medium rounded-lg"
                          value={r.amountFils > 0 ? r.fromAccountId ?? "" : r.toAccountId ?? ""}
                          onChange={(e) =>
                            update(i, r.amountFils > 0 ? { fromAccountId: e.target.value } : { toAccountId: e.target.value })
                          }
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
                        <select
                          className="py-1 px-2 text-xs font-medium rounded-lg"
                          value={r.category ?? "other"}
                          onChange={(e) => update(i, { category: e.target.value })}
                        >
                          {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c[lang]}
                            </option>
                          ))}
                        </select>
                      )}
                      {(r.kind === "bank_fee" || r.kind === "income") && (
                        <span className="text-slate-400 font-medium">{acctName(bankId)}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pt-2">
            <Button
              size="lg"
              loading={busy}
              disabled={!bankId || !amountReady}
              onClick={submit}
              className="w-full sm:w-auto"
            >
              <FileCheck className="h-4 w-4" />
              <span>
                {a.import_btn} (<span className="num">{rows.filter((r) => r.kind !== "skip").length}</span>)
              </span>
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
