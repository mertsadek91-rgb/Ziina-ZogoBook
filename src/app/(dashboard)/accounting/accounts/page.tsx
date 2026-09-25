"use client";

import { useEffect, useState } from "react";
import { Plus, Save, Users, Landmark, CreditCard, UserRound, Calendar } from "lucide-react";
import { Alert, Button, Card, Badge } from "@/components/ui";
import { useAccounts, type Account } from "@/components/ledger";
import { api } from "@/components/fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { fromFils } from "@/lib/money";

const dubai = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(iso)) : "");

const ICONS: Record<string, React.ReactNode> = {
  gateway: <CreditCard className="h-4 w-4 text-purple-600" />,
  bank: <Landmark className="h-4 w-4 text-sky-600" />,
  partner: <UserRound className="h-4 w-4 text-brand" />,
};

const TONES: Record<string, "blue" | "purple" | "green" | "gray"> = {
  gateway: "purple",
  bank: "blue",
  partner: "green",
};

const ACCENT_BORDERS: Record<string, string> = {
  gateway: "border-s-4 border-s-purple-500",
  bank: "border-s-4 border-s-sky-500",
  partner: "border-s-4 border-s-brand",
};

export default function AccountsPage() {
  const { a, accountKindLabel } = useAcc();
  const { accounts, reload, error: accountsError } = useAccounts();
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [newAcc, setNewAcc] = useState({ name: "", kind: "bank" });
  const [creating, setCreating] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setMsg(null);
    try {
      await api("/api/accounting/accounts", { body: { action: "create", ...newAcc } });
      setNewAcc({ name: "", kind: newAcc.kind });
      setMsg({ tone: "success", text: a.saved });
      await reload();
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Description Card */}
      <Card className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand font-bold shadow-2xs">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-900">{a.accounts_title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{a.accounts_desc}</p>
        </div>
      </Card>

      {accountsError && <Alert tone="error">{accountsError}</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {/* Account Cards Grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((acc) => (
          <AccountCard
            key={acc.id}
            acc={acc}
            kindLabel={accountKindLabel(acc.kind)}
            onSaved={(t) => setMsg({ tone: "success", text: t })}
            onError={(t) => setMsg({ tone: "error", text: t })}
          />
        ))}
      </div>

      {/* Add New Account Card */}
      <Card className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Plus className="h-4 w-4 text-brand" />
          <h3 className="text-sm font-bold text-slate-900">{a.add_account}</h3>
        </div>

        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label>{a.name}</label>
            <input
              required
              placeholder="e.g. Wio Bank, Stripe, Partner Name"
              value={newAcc.name}
              onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })}
            />
          </div>
          <div className="w-full sm:w-48">
            <label>{a.kind}</label>
            <select value={newAcc.kind} onChange={(e) => setNewAcc({ ...newAcc, kind: e.target.value })}>
              {["bank", "gateway", "partner"].map((k) => (
                <option key={k} value={k}>
                  {accountKindLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" loading={creating} variant="primary">
            <Plus className="h-4 w-4" />
            <span>{a.add_account}</span>
          </Button>
        </form>
      </Card>
    </div>
  );
}

function AccountCard({
  acc,
  kindLabel,
  onSaved,
  onError,
}: {
  acc: Account;
  kindLabel: string;
  onSaved: (t: string) => void;
  onError: (t: string) => void;
}) {
  const { a } = useAcc();
  const [name, setName] = useState(acc.name);
  const [opening, setOpening] = useState(String(fromFils(acc.openingFils)));
  const [openingDate, setOpeningDate] = useState(dubai(acc.openingDate));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(acc.name);
    setOpening(String(fromFils(acc.openingFils)));
    setOpeningDate(dubai(acc.openingDate));
  }, [acc]);

  async function save() {
    setBusy(true);
    try {
      await api("/api/accounting/accounts", {
        body: { action: "update", id: acc.id, name, opening: opening || 0, openingDate },
      });
      onSaved(`${a.saved}: ${name}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className={`space-y-4 hover:border-slate-300 transition duration-150 ${ACCENT_BORDERS[acc.kind] || ""}`}>
      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 shadow-2xs">
            {ICONS[acc.kind]}
          </div>
          <Badge tone={TONES[acc.kind] ?? "gray"}>{kindLabel}</Badge>
        </div>
        {acc.key && (
          <span className="num rounded bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600">
            {acc.key}
          </span>
        )}
      </div>

      <div>
        <label>{a.name}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} className="py-2 text-xs font-semibold" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label>{a.opening} (AED)</label>
          <input
            type="number"
            step="0.01"
            dir="ltr"
            value={opening}
            onChange={(e) => setOpening(e.target.value)}
            className="py-2 text-xs font-bold"
          />
        </div>
        <div>
          <label>{a.opening_date}</label>
          <div className="relative">
            <Calendar className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="date"
              value={openingDate}
              onChange={(e) => setOpeningDate(e.target.value)}
              className="ps-8 py-2 text-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-1">
        <Button size="sm" variant="secondary" loading={busy} onClick={save}>
          <Save className="h-3.5 w-3.5" />
          <span>{a.save}</span>
        </Button>
      </div>
    </Card>
  );
}
