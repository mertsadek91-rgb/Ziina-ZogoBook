"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
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
  fromAccount: { name: string } | null;
  toAccount: { name: string } | null;
}

const KINDS = ["transfer", "expense", "bank_fee", "income"] as const;
const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date());
const fmtDate = (s: string) => new Date(s).toLocaleDateString("en-GB", { timeZone: "Asia/Dubai" });

export default function EntriesPage() {
  const { a, lang, kindLabel, categoryLabel } = useAcc();
  const { accounts, error: accountsError } = useAccounts();

  const empty = { date: today(), kind: "transfer", amount: "", fee: "", fromAccountId: "", toAccountId: "", category: "ads", description: "", reference: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [filter, setFilter] = useState({ from: "", to: "", kind: "", account: "" });
  const [entries, setEntries] = useState<Entry[] | null>(null);

  const load = useCallback(async () => {
    const p = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
    const r = await api<{ entries: Entry[] }>(`/api/accounting/entries?${p}`);
    setEntries(r.entries);
  }, [filter]);

  useEffect(() => {
    load().catch((e) => setMsg({ tone: "error", text: String(e) }));
  }, [load]);

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/accounting/entries", { body: form });
      setMsg({ tone: "success", text: a.saved });
      setForm({ ...empty, date: form.date, kind: form.kind, fromAccountId: form.fromAccountId });
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
    await load();
  }

  const k = form.kind;
  const showFrom = k !== "income";
  const showTo = k === "transfer" || k === "income";

  return (
    <div className="grid gap-6 xl:grid-cols-5">
      {/* Add entry */}
      <Card className="h-fit space-y-4 xl:col-span-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Plus className="h-4 w-4" /> {a.add_entry}
        </h2>
        {accountsError && <Alert tone="error">{accountsError}</Alert>}
        {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
        <form onSubmit={save} className="space-y-3">
          <div className="grid grid-cols-2 gap-1.5">
            {KINDS.map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => set("kind")(x)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  k === x ? "border-brand bg-brand-50 text-brand" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
              >
                {kindLabel(x)}
              </button>
            ))}
          </div>
          {k === "transfer" && <p className="text-[11px] text-slate-500">{a.transfer_hint}</p>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>{a.date}</label>
              <input type="date" required value={form.date} onChange={(e) => set("date")(e.target.value)} />
            </div>
            <div>
              <label>{a.amount}</label>
              <input type="number" step="0.01" min="0.01" required dir="ltr" value={form.amount} onChange={(e) => set("amount")(e.target.value)} />
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
              <input type="number" step="0.01" min="0" dir="ltr" value={form.fee} onChange={(e) => set("fee")(e.target.value)} />
            </div>
          )}
          {k === "expense" && (
            <div>
              <label>{a.category}</label>
              <select value={form.category} onChange={(e) => set("category")(e.target.value)}>
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
            <input value={form.description} onChange={(e) => set("description")(e.target.value)} />
          </div>
          <div>
            <label>{a.reference}</label>
            <input dir="ltr" value={form.reference} onChange={(e) => set("reference")(e.target.value)} />
          </div>
          <Button type="submit" loading={busy} className="w-full">
            {a.save_entry}
          </Button>
        </form>
      </Card>

      {/* List */}
      <div className="space-y-3 xl:col-span-3">
        <Card className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div>
            <label>{a.from}</label>
            <input type="date" value={filter.from} onChange={(e) => setFilter({ ...filter, from: e.target.value })} />
          </div>
          <div>
            <label>{a.to}</label>
            <input type="date" value={filter.to} onChange={(e) => setFilter({ ...filter, to: e.target.value })} />
          </div>
          <div>
            <label>{a.kind}</label>
            <select value={filter.kind} onChange={(e) => setFilter({ ...filter, kind: e.target.value })}>
              <option value="">{a.all_kinds}</option>
              {KINDS.map((x) => (
                <option key={x} value={x}>
                  {kindLabel(x)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>{a.tab_accounts}</label>
            <AccountSelect
              accounts={accounts}
              value={filter.account}
              onChange={(v) => setFilter({ ...filter, account: v })}
              placeholder={a.all_accounts}
            />
          </div>
        </Card>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-start text-xs text-slate-500">
              <tr>
                <th className="p-3 text-start">{a.date}</th>
                <th className="p-3 text-start">{a.kind}</th>
                <th className="p-3 text-start">
                  {a.from_account} → {a.to_account}
                </th>
                <th className="p-3 text-start">{a.description}</th>
                <th className="p-3 text-end">{a.amount}</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {entries?.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400">
                    {a.no_entries}
                  </td>
                </tr>
              )}
              {entries?.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="num whitespace-nowrap p-3 text-slate-600">{fmtDate(e.date)}</td>
                  <td className="p-3">
                    <Badge tone={e.kind === "transfer" ? "blue" : e.kind === "income" ? "green" : e.kind === "bank_fee" ? "purple" : "yellow"}>
                      {kindLabel(e.kind)}
                    </Badge>
                    {e.kind === "expense" && <div className="mt-1 text-[11px] text-slate-500">{categoryLabel(e.category)}</div>}
                  </td>
                  <td className="p-3 text-xs text-slate-700">
                    {e.fromAccount?.name ?? "—"} {e.kind === "transfer" ? "→" : ""} {e.kind === "transfer" || e.kind === "income" ? e.toAccount?.name ?? "—" : ""}
                  </td>
                  <td className="max-w-64 p-3 text-xs text-slate-600">
                    <div className="truncate" title={e.description ?? ""}>
                      {e.description}
                    </div>
                    <div className="text-[10px] text-slate-400">{e.source === "bank_csv" ? a.source_bank : a.source_manual}</div>
                  </td>
                  <td className="whitespace-nowrap p-3 text-end">
                    <Money fils={e.kind === "income" ? e.amountFils : e.kind === "transfer" ? e.amountFils : -e.amountFils} strong />
                    {e.feeFils > 0 && <div className="num text-[10px] text-slate-400">+{(e.feeFils / 100).toFixed(2)}</div>}
                  </td>
                  <td className="p-3 text-end">
                    <button type="button" onClick={() => remove(e.id)} className="text-slate-400 hover:text-rose-600" title={a.delete}>
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
  );
}
