"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "./fetcher";

export interface Item {
  item_id: string;
  name: string;
  rate: number;
  sku?: string;
}

export function ItemPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string, name: string) => void;
}) {
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(refresh = false) {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ items: Item[] }>(`/api/zoho/items${refresh ? "?refresh=1" : ""}`);
      setItems(r.items);
      if (!value) {
        const s = await api<{ settings: Record<string, string | null> }>("/api/settings").catch(() => null);
        const def = s?.settings.default_item_id;
        const found = def && r.items.find((i) => i.item_id === def);
        if (found) onChange(found.item_id, found.name);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? items.filter((i) => i.name.toLowerCase().includes(s) || i.sku?.toLowerCase().includes(s)) : items;
  }, [items, q]);

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input placeholder="بحث في الخدمات..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="shrink-0 text-sm text-brand hover:underline" onClick={() => load(true)}>
          تحديث
        </button>
      </div>
      {error && <div className="text-sm text-red-600">تعذّر جلب الخدمات: {error}</div>}
      <select
        size={Math.min(8, Math.max(3, filtered.length))}
        value={value}
        onChange={(e) => {
          const it = items.find((i) => i.item_id === e.target.value);
          if (it) onChange(it.item_id, it.name);
        }}
        disabled={loading}
      >
        {loading && <option>جارِ التحميل...</option>}
        {filtered.map((i) => (
          <option key={i.item_id} value={i.item_id}>
            {i.name} {i.rate ? `— ${i.rate} ` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
