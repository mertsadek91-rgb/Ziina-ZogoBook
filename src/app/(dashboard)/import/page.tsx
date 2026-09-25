"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Alert, Button, Card } from "@/components/ui";
import { api } from "@/components/fetcher";

const FIELDS = [
  { key: "ziinaIntentId", label: "رقم العملية / ID *", guess: ["id", "payment id", "transaction id", "reference", "payment_intent_id"] },
  { key: "amount", label: "المبلغ *", guess: ["amount", "gross", "total", "value"] },
  { key: "fee", label: "الرسوم", guess: ["fee", "fees", "commission"] },
  { key: "status", label: "الحالة", guess: ["status", "state"] },
  { key: "date", label: "التاريخ", guess: ["date", "created", "created at", "time"] },
  { key: "message", label: "الوصف", guess: ["message", "description", "note", "notes"] },
  { key: "customerName", label: "اسم العميل", guess: ["name", "customer", "customer name", "payer"] },
  { key: "customerEmail", label: "الإيميل", guess: ["email", "customer email"] },
  { key: "customerPhone", label: "الهاتف", guess: ["phone", "mobile"] },
] as const;

type Key = (typeof FIELDS)[number]["key"];

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Partial<Record<Key, string>>>({});
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [trackId, setTrackId] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);

  function onFile(file: File) {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields ?? [];
        setHeaders(hs);
        setRows(res.data);
        const guessMap: Partial<Record<Key, string>> = {};
        for (const f of FIELDS) {
          const h = hs.find((x) => (f.guess as readonly string[]).includes(x.trim().toLowerCase()));
          if (h) guessMap[f.key] = h;
        }
        setMap(guessMap);
        setMsg(null);
      },
    });
  }

  async function submit() {
    setBusy(true);
    setMsg(null);
    try {
      const mapped = rows
        .map((r) => {
          const o: Record<string, string> = {};
          for (const f of FIELDS) {
            const col = map[f.key];
            if (col && r[col] !== undefined && r[col] !== "") o[f.key] = String(r[col]).trim();
          }
          return o;
        })
        .filter((o) => o.ziinaIntentId && o.amount);
      const r = await api<{ created: number; skipped: number; errors: string[] }>("/api/payments/import", {
        body: { rows: mapped },
      });
      setMsg({
        tone: r.errors.length ? "error" : "success",
        text: `تمت إضافة ${r.created}، تم تخطي ${r.skipped} (موجودة مسبقًا).${r.errors.length ? " أخطاء: " + r.errors.join(" | ") : ""}`,
      });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function track() {
    setTrackBusy(true);
    setMsg(null);
    try {
      const r = await api<{ payment: { id: string } }>("/api/payments/track", { body: { intentId: trackId } });
      location.href = `/payments/${r.payment.id}`;
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
      setTrackBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-bold">استيراد دفعات</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <Card className="space-y-3">
        <h2 className="font-semibold">إضافة دفعة برقمها في Ziina</h2>
        <p className="text-sm text-gray-500">إذا كان لديك Payment Intent ID لدفعة أُنشئت خارج التطبيق، سيتم جلب تفاصيلها من Ziina.</p>
        <div className="flex gap-2">
          <input dir="ltr" value={trackId} onChange={(e) => setTrackId(e.target.value)} placeholder="payment intent id" />
          <Button loading={trackBusy} disabled={!trackId.trim()} onClick={track}>
            جلب
          </Button>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">استيراد ملف CSV من لوحة Ziina</h2>
        <p className="text-sm text-gray-500">
          صدّر المعاملات من لوحة Ziina كملف CSV ثم ارفعه هنا وطابق الأعمدة. الدفعات الموجودة مسبقًا (بنفس الرقم) يتم تخطيها.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

        {headers.length > 0 && (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {FIELDS.map((f) => (
                <div key={f.key}>
                  <label>{f.label}</label>
                  <select value={map[f.key] ?? ""} onChange={(e) => setMap({ ...map, [f.key]: e.target.value || undefined })}>
                    <option value="">— تجاهل —</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="bg-gray-50">
                  <tr>
                    {FIELDS.filter((f) => map[f.key]).map((f) => (
                      <th key={f.key} className="p-2 text-right">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((r, i) => (
                    <tr key={i} className="border-t">
                      {FIELDS.filter((f) => map[f.key]).map((f) => (
                        <td key={f.key} className="p-2">
                          {r[map[f.key]!]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="text-sm text-gray-500">عدد الأسطر: {rows.length} (معاينة أول 5)</div>
            <Button loading={busy} disabled={!map.ziinaIntentId || !map.amount} onClick={submit}>
              استيراد
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
