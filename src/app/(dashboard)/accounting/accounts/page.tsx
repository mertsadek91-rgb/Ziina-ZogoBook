"use client";

import { useEffect, useState } from "react";
import { Plus, Save } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { useAccounts, type Account } from "@/components/ledger";
import { api } from "@/components/fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { fromFils } from "@/lib/money";

const dubai = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(new Date(iso)) : "");

export default function AccountsPage() {
  const { a, accountKindLabel } = useAcc();
  const { accounts, reload, error: accountsError } = useAccounts();
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [newAcc, setNewAcc] = useState({ name: "", kind: "bank" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api("/api/accounting/accounts", { body: { action: "create", ...newAcc } });
      setNewAcc({ name: "", kind: newAcc.kind });
      await reload();
    } catch (err) {
      setMsg({ tone: "error", text: err instanceof Error ? err.message : String(err) });
    }
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-1">
        <h2 className="text-sm font-bold text-slate-900">{a.accounts_title}</h2>
        <p className="text-xs text-slate-500">{a.accounts_desc}</p>
      </Card>
      {accountsError && <Alert tone="error">{accountsError}</Alert>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map((acc) => (
          <AccountCard key={acc.id} acc={acc} kindLabel={accountKindLabel(acc.kind)} onSaved={(t) => setMsg({ tone: "success", text: t })} onError={(t) => setMsg({ tone: "error", text: t })} />
        ))}
      </div>
      <Card>
        <form onSubmit={add} className="flex flex-wrap items-end gap-3">
          <div className="min-w-48 flex-1">
            <label>{a.name}</label>
            <input required value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })} />
          </div>
          <div>
            <label>{a.kind}</label>
            <select value={newAcc.kind} onChange={(e) => setNewAcc({ ...newAcc, kind: e.target.value })}>
              {["bank", "gateway", "partner"].map((k) => (
                <option key={k} value={k}>
                  {accountKindLabel(k)}
                </option>
              ))}
            </select>
          </div>
          <Button type="submit" variant="secondary">
            <Plus className="h-4 w-4" /> {a.add_account}
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
      await api("/api/accounting/accounts", { body: { action: "update", id: acc.id, name, opening: opening || 0, openingDate } });
      onSaved(`${a.saved}: ${name}`);
    } catch (err) {
      onError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">{kindLabel}</span>
        {acc.key && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">{acc.key}</span>}
      </div>
      <div>
        <label>{a.name}</label>
        <input value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label>{a.opening}</label>
          <input type="number" step="0.01" dir="ltr" value={opening} onChange={(e) => setOpening(e.target.value)} />
        </div>
        <div>
          <label>{a.opening_date}</label>
          <input type="date" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} />
        </div>
      </div>
      <Button size="sm" variant="secondary" loading={busy} onClick={save}>
        <Save className="h-3.5 w-3.5" /> {a.save}
      </Button>
    </Card>
  );
}
