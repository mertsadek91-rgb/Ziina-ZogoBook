"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, RefreshCw, AlertCircle } from "lucide-react";
import { api } from "./fetcher";
import { useI18n } from "@/lib/i18n";

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
  const { lang } = useI18n();
  const [items, setItems] = useState<Item[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(refresh = false) {
    if (refresh) setRefreshing(true);
    else setLoading(true);
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
      setRefreshing(false);
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
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
          <input
            placeholder={lang === "ar" ? "بحث في قائمة خدمات Zoho Books..." : "Search Zoho Books service items..."}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="ps-9 py-2 text-xs"
          />
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shrink-0"
          onClick={() => load(true)}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin text-brand" : "text-slate-400"}`} />
          <span>{lang === "ar" ? "تحديث" : "Refresh"}</span>
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{lang === "ar" ? `تعذّر جلب الخدمات: ${error}` : `Failed to load items: ${error}`}</span>
        </div>
      )}

      <select
        size={Math.min(6, Math.max(3, filtered.length))}
        value={value}
        onChange={(e) => {
          const it = items.find((i) => i.item_id === e.target.value);
          if (it) onChange(it.item_id, it.name);
        }}
        disabled={loading}
        className="w-full text-xs font-medium"
      >
        {loading && <option>{lang === "ar" ? "جارِ تحميل الخدمات من Zoho..." : "Loading items from Zoho..."}</option>}
        {filtered.map((i) => (
          <option key={i.item_id} value={i.item_id} className="py-1">
            {i.name} {i.rate ? `(${i.rate} AED)` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
