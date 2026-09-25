"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Plus,
  Trash2,
  Pencil,
  X,
  ArrowRightLeft,
  Receipt,
  Landmark,
  TrendingUp,
  Calendar,
  Filter,
  Inbox,
  ArrowRight,
} from "lucide-react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { AccountSelect, Money, useAccounts } from "@/components/ledger";
import { api } from "@/components/fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { EXPENSE_CATEGORIES } from "@/lib/ledger-calc";

interface Entry {
  id: string;
  date: string;
  kind: string;
  amountFils: number;
  feeFils: number;
  category: string | null;
  description: string | null;
  reference: string | null;
  source: string;
  fromAccountId: string | null;
  toAccountId: string | null;
  fromAccount: { name: string } | null;
  toAccount: { name: string } | null;
}

const KINDS = ["transfer", "expense", "bank_fee", "income"] as const;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" });
const dubaiDay = (s: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(s));

const KIND_ICONS: Record<string, React.ReactNode> = {
  transfer: <ArrowRightLeft className="h-3.5 w-3.5" />,
  expense: <Receipt className="h-3.5 w-3.5" />,
  bank_fee: <Landmark className="h-3.5 w-3.5" />,
  income: <TrendingUp className="h-3.5 w-3.5" />,
};

const KIND_ACTIVE: Record<string, string> = {
  transfer: "border-brand bg-brand-50 text-brand shadow-2xs font-bold",
  expense: "border-rose-400 bg-rose-50 text-rose-700 shadow-2xs font-bold",
  bank_fee: "border-purple-400 bg-purple-50 text-purple-700 shadow-2xs font-bold",
  income: "border-emerald-400 bg-emerald-50 text-emerald-700 shadow-2xs font-bold",
};

const ENTRY_TONES: Record<string, "blue" | "green" | "purple" | "red" | "gray"> = {
  transfer: "blue",
  income: "green",
  bank_fee: "purple",
  expense: "red",
};

export default function EntriesPage() {
  const { a, lang, kindLabel, categoryLabel } = useAcc();
  const { accounts, error: accountsError } = useAccounts();

  const empty = {
    date: today(),
    kind: "transfer",
    amount: "",
    fee: "",
    fromAccountId: "",
    toAccountId: "",
    category: "ads",
    description: "",
    reference: "",
  };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [filter, setFilter] = useState({ from: "", to: "", kind: "", account: "" });
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [editing, setEditing] = useState<Entry | null>(null);
  const locked = editing?.source === "bank_csv"; // bank facts: date, amount, reference

  const load = useCallback(async () => {
    const p = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
    const r = await api<{ entries: Entry[] }>(`/api/accounting/entries?${p}`);
    setEntries(r.entries);
  }, [filter]);

  useEffect(() => {
    load().catch((e) => setMsg({ tone: "error", text: String(e) }));
  }, [load]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  function startEdit(e: Entry) {
    setEditing(e);
    setMsg(null);
    setForm({
      date: dubaiDay(e.date),
      kind: e.kind,
      amount: (e.amountFils / 100).toFixed(2),
      fee: e.feeFils ? (e.feeFils / 100).toFixed(2) : "",
      fromAccountId: e.fromAccountId ?? "",
      toAccountId: e.toAccountId ?? "",
      category: e.category ?? "ads",
      description: e.description ?? "",
      reference: e.reference ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditing(null);
    setForm(empty);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      if (editing) {
        await api(`/api/accounting/entries/${editing.id}`, { method: "PATCH", body: form });
        setEditing(null);
        setForm(empty);
      } else {
        await api("/api/accounting/entries", { body: form });
        setForm({ ...empty, date: form.date, kind: form.kind, fromAccountId: form.fromAccountId });
      }
      setMsg({ tone: "success", text: a.saved });
      await load();
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(a.confirm_delete)) return;
    await api(`/api/accounting/entries/${id}`, { method: "DELETE" });
    if (editing?.id === id) cancelEdit();
    await load();
  }

  const k = form.kind;
  const showFrom = k !== "income";
  const showTo = k === "transfer" || k === "income";

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* Add Entry Card (2 Cols on xl) */}
      <Card className="h-fit space-y-4 xl:col-span-2">
        <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
          <div className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold ${editing ? "bg-amber-50 text-amber-600" : "bg-brand-50 text-brand"}`}>
            {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          </div>
          <h2 className="text-sm font-bold text-slate-900">{editing ? a.edit_entry : a.add_entry}</h2>
          {editing && (
            <button type="button" onClick={cancelEdit} className="ms-auto rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title={a.cancel_edit}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {locked && <Alert tone="info">{a.bank_locked_hint}</Alert>}

        {accountsError && <Alert tone="error">{accountsError}</Alert>}
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

        <form onSubmit={save} className="space-y-3.5">
          {/* Kind Toggle Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {KINDS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => set("kind")(x)}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2.5 text-xs font-semibold transition active:scale-[0.98] ${
                  k === x
                    ? KIND_ACTIVE[x]
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {KIND_ICONS[x]}
                <span>{kindLabel(x)}</span>
              </button>
            ))}
          </div>

          {k === "transfer" && <p className="text-[11px] text-slate-500 leading-relaxed bg-slate-50 p-2.5 rounded-xl">{a.transfer_hint}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>{a.date}</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="date"
                  required
                  disabled={locked}
                  value={form.date}
                  onChange={(e) => set("date")(e.target.value)}
                  className="ps-8 py-2 text-xs"
                />
              </div>
            </div>
            <div>
              <label>{a.amount}</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                disabled={locked}
                dir="ltr"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => set("amount")(e.target.value)}
                className="font-bold py-2 text-xs"
              />
            </div>
          </div>

          {showFrom && (
            <div>
              <label>{k === "transfer" ? a.from_account : a.paid_from}</label>
              <AccountSelect accounts={accounts} value={form.fromAccountId} onChange={set("fromAccountId")} />
            </div>
          )}
          {showTo && (
            <div>
              <label>{k === "transfer" ? a.to_account : a.received_in}</label>
              <AccountSelect
                accounts={accounts}
                value={form.toAccountId}
                onChange={set("toAccountId")}
                kinds={k === "income" ? ["bank", "gateway"] : undefined}
              />
            </div>
          )}
          {k === "transfer" && (
            <div>
              <label>{a.fee}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                dir="ltr"
                placeholder="0.00"
                value={form.fee}
                onChange={(e) => set("fee")(e.target.value)}
                className="py-2 text-xs"
              />
            </div>
          )}
          {k === "expense" && (
            <div>
              <label>{a.category}</label>
              <select value={form.category} onChange={(e) => set("category")(e.target.value)} className="py-2 text-xs">
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c[lang]}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label>{a.description}</label>
            <input
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              className="py-2 text-xs"
              placeholder={lang === "ar" ? "تفاصيل العملية..." : "Entry details..."}
            />
          </div>
          <div>
            <label>{a.reference}</label>
            <input
              dir="ltr"
              disabled={locked}
              value={form.reference}
              onChange={(e) => set("reference")(e.target.value)}
              className="py-2 text-xs"
              placeholder="Ref #"
            />
          </div>
          <div className="flex gap-2">
            <Button type="submit" loading={busy} size="lg" className="flex-1">
              {editing ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              <span>{editing ? a.save_changes : a.save_entry}</span>
            </Button>
            {editing && (
              <Button type="button" variant="secondary" size="lg" onClick={cancelEdit}>
                {a.cancel_edit}
              </Button>
            )}
          </div>
        </form>
      </Card>

      {/* Entries List and Filters (3 Cols on xl) */}
      <div className="space-y-4 xl:col-span-3">
        {/* Filter Bar */}
        <Card className="grid grid-cols-2 gap-3 sm:grid-cols-4 p-3.5">
          <div>
            <label className="text-[11px] text-slate-500">{a.from}</label>
            <input
              type="date"
              value={filter.from}
              onChange={(e) => setFilter({ ...filter, from: e.target.value })}
              className="py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">{a.to}</label>
            <input
              type="date"
              value={filter.to}
              onChange={(e) => setFilter({ ...filter, to: e.target.value })}
              className="py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">{a.kind}</label>
            <select
              value={filter.kind}
              onChange={(e) => setFilter({ ...filter, kind: e.target.value })}
              className="py-1.5 text-xs"
            >
              <option value="">{a.all_kinds}</option>
              {KINDS.map((x) => (
                <option key={x} value={x}>
                  {kindLabel(x)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[11px] text-slate-500">{a.tab_accounts}</label>
            <AccountSelect
              accounts={accounts}
              value={filter.account}
              onChange={(v) => setFilter({ ...filter, account: v })}
              placeholder={a.all_accounts}
              className="py-1.5 text-xs"
            />
          </div>
        </Card>

        {/* Mobile View: Cards */}
        <div className="space-y-3 md:hidden">
          {entries?.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white p-8 text-center">
              <Inbox className="h-8 w-8 text-slate-300 mb-2" />
              <div className="text-xs font-semibold text-slate-600">{a.no_entries}</div>
            </div>
          ) : (
            entries?.map((e) => (
              <div key={e.id} className={`rounded-2xl border bg-white p-4 shadow-xs space-y-2 ${editing?.id === e.id ? "border-amber-300 ring-2 ring-amber-200" : "border-slate-200/80"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Badge tone={ENTRY_TONES[e.kind] || "gray"}>
                        {kindLabel(e.kind)}
                      </Badge>
                      <span className="num text-xs text-slate-400">{fmtDate(e.date)}</span>
                    </div>
                    <div className="text-xs font-bold text-slate-800">
                      {e.fromAccount?.name ?? "—"} {e.kind === "transfer" ? "→" : ""}{" "}
                      {e.kind === "transfer" || e.kind === "income" ? e.toAccount?.name ?? "—" : ""}
                    </div>
                  </div>

                  <div className="text-end">
                    <Money
                      fils={e.kind === "income" ? e.amountFils : e.kind === "transfer" ? e.amountFils : -e.amountFils}
                      strong
                      signColor
                    />
                    {e.feeFils > 0 && <div className="num text-[10px] text-slate-400">+{(e.feeFils / 100).toFixed(2)}</div>}
                  </div>
                </div>

                {e.description && <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded-xl">{e.description}</div>}

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                  <span className="text-slate-400">
                    {e.source === "bank_csv" ? a.source_bank : a.source_manual}
                    {e.reference ? ` · #${e.reference}` : ""}
                  </span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => startEdit(e)} className="p-1 text-slate-400 hover:text-brand" title={a.edit}>
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(e.id)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                      title={a.delete}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs md:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-start">{a.date}</th>
                  <th className="p-3 text-start">{a.kind}</th>
                  <th className="p-3 text-start">
                    {a.from_account} → {a.to_account}
                  </th>
                  <th className="p-3 text-start">{a.description}</th>
                  <th className="p-3 text-end">{a.amount}</th>
                  <th className="w-20 p-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {entries?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-12 text-center text-slate-400">
                      <div className="flex flex-col items-center justify-center">
                        <Inbox className="h-8 w-8 text-slate-300 mb-2" />
                        <div className="text-xs font-semibold text-slate-600">{a.no_entries}</div>
                      </div>
                    </td>
                  </tr>
                )}
                {entries?.map((e) => (
                  <tr key={e.id} className={`transition duration-100 ${editing?.id === e.id ? "bg-amber-50/70" : "hover:bg-slate-50/70"}`}>
                    <td className="num whitespace-nowrap p-3 text-xs text-slate-500 font-medium">{fmtDate(e.date)}</td>
                    <td className="p-3">
                      <Badge tone={ENTRY_TONES[e.kind] || "gray"}>
                        {kindLabel(e.kind)}
                      </Badge>
                      {e.kind === "expense" && <div className="mt-1 text-[11px] text-slate-500">{categoryLabel(e.category)}</div>}
                    </td>
                    <td className="p-3 text-xs font-medium text-slate-700">
                      {e.fromAccount?.name ?? "—"} {e.kind === "transfer" ? "→" : ""}{" "}
                      {e.kind === "transfer" || e.kind === "income" ? e.toAccount?.name ?? "—" : ""}
                    </td>
                    <td className="max-w-64 p-3 text-xs text-slate-600">
                      <div className="truncate font-medium text-slate-800" title={e.description ?? ""}>
                        {e.description || "—"}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {e.source === "bank_csv" ? a.source_bank : a.source_manual}
                        {e.reference ? ` · #${e.reference}` : ""}
                      </div>
                    </td>
                    <td className="whitespace-nowrap p-3 text-end">
                      <Money
                        fils={e.kind === "income" ? e.amountFils : e.kind === "transfer" ? e.amountFils : -e.amountFils}
                        strong
                        signColor
                      />
                      {e.feeFils > 0 && <div className="num text-[10px] text-slate-400">+{(e.feeFils / 100).toFixed(2)}</div>}
                    </td>
                    <td className="whitespace-nowrap p-3 text-end">
                      <button
                        type="button"
                        onClick={() => startEdit(e)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-brand-50 hover:text-brand transition"
                        title={a.edit}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(e.id)}
                        className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                        title={a.delete}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
