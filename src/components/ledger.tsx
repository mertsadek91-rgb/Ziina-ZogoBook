"use client";

import { useEffect, useState } from "react";
import { api } from "./fetcher";
import { useAcc } from "@/lib/i18n-acc";
import { formatMoney } from "@/lib/money";

export interface Account {
  id: string;
  key: string | null;
  name: string;
  kind: string;
  openingFils: number;
  openingDate: string | null;
}

/** Loads the ledger accounts once (creates the default ones on first use). */
export function useAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = async () => {
    setLoading(true);
    try {
      const r = await api<{ accounts: Account[] }>("/api/accounting/accounts");
      setAccounts(r.accounts);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    reload();
  }, []);
  return { accounts, loading, error, reload };
}

/** Account picker, optionally limited to some kinds. */
export function AccountSelect({
  accounts,
  value,
  onChange,
  kinds,
  placeholder,
  disabled,
  className,
}: {
  accounts: Account[];
  value: string;
  onChange: (id: string) => void;
  kinds?: string[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const { accountKindLabel } = useAcc();
  const list = kinds ? accounts.filter((x) => kinds.includes(x.kind)) : accounts;
  return (
    <select value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={className}>
      <option value="">{placeholder ?? "—"}</option>
      {list.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name} ({accountKindLabel(x.kind)})
        </option>
      ))}
    </select>
  );
}

/** Partner picker used on payments. Pass `partners` to avoid one request per row. */
export function PartnerSelect({
  value,
  onChange,
  partners,
  disabled,
  compact,
  className,
}: {
  value: string;
  onChange: (id: string) => void;
  partners?: { id: string; name: string }[];
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const { a } = useAcc();
  const [own, setOwn] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    if (partners) return;
    api<{ accounts: Account[] }>("/api/accounting/accounts")
      .then((r) => setOwn(r.accounts.filter((x) => x.kind === "partner")))
      .catch(() => setOwn([]));
  }, [partners]);
  const list = partners ?? own;
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={`${compact ? "!py-1 !px-2 !text-xs !rounded-lg" : ""} ${className ?? ""}`.trim()}
    >
      <option value="">{a.no_partner}</option>
      {list.map((x) => (
        <option key={x.id} value={x.id}>
          {x.name}
        </option>
      ))}
    </select>
  );
}

/** Signed AED amount: red when negative. */
export function Money({ fils, strong, signColor }: { fils: number; strong?: boolean; signColor?: boolean }) {
  const cls = signColor ? (fils < 0 ? "text-rose-600" : fils > 0 ? "text-emerald-700" : "text-slate-500") : "";
  return <span className={`num ${strong ? "font-bold" : ""} ${cls}`}>{formatMoney(fils, "AED")}</span>;
}
