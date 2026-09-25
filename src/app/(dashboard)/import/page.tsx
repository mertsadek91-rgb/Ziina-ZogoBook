"use client";

import { useState } from "react";
import Papa from "papaparse";
import { Alert, Button, Card } from "@/components/ui";
import { api } from "@/components/fetcher";
import { isZiinaExport, mapZiinaExport, type ImportRow, type ZiinaMapResult } from "@/lib/ziina-csv";

const FIELDS = [
  { key: "ziinaIntentId", label: "رقم العملية / ID *", guess: ["id", "payment id", "transaction id", "reference", "payment_intent_id"] },
  { key: "amount", label: "المبلغ *", guess: ["amount", "gross", "total", "value"] },
  { key: "fee", label: "الرسوم", guess: ["fee", "fees", "commission"] },
  { key: "status", label: "الحالة", guess: ["status", "state"] },
  { key: "date", label: "التاريخ", guess: ["date", "created", "created at", "time"] },
  { key: "message", label: "الوصف", guess: ["message", "description", "note", "notes"] },
  { key: "orderNumber", label: "رقم الطلب", guess: ["order", "order number", "order #", "invoice number"] },
  { key: "customerName", label: "اسم العميل", guess: ["name", "customer", "customer name", "payer"] },
  { key: "customerEmail", label: "الإيميل", guess: ["email", "customer email"] },
  { key: "customerPhone", label: "الهاتف", guess: ["phone", "mobile", "customer phone", "customer phone number"] },
] as const;

type Key = (typeof FIELDS)[number]["key"];

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "short", timeStyle: "short" }) : "—";

export default function ImportPage() {
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Partial<Record<Key, string>>>({});
  const [ziina, setZiina] = useState<ZiinaMapResult | null>(null);
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
        setRecords(res.data);
        setMsg(null);
        if (isZiinaExport(hs)) {
          setZiina(mapZiinaExport(res.data));
          return;
        }
        setZiina(null);
        const guessMap: Partial<Record<Key, string>> = {};
        for (const f of FIELDS) {
          const h = hs.find((x) => (f.guess as readonly string[]).includes(x.trim().toLowerCase()));
          if (h) guessMap[f.key] = h;
        }
        setMap(guessMap);
      },
    });
  }

  async function send(rows: ImportRow[]) {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ created: number; updated: number; skipped: number; errors: string[] }>("/api/payments/import", {
        body: { rows },
      });
      setMsg({
        tone: r.errors.length ? "error" : "success",
        text:
          `تمت إضافة ${r.created} دفعة، واستكمال بيانات ${r.updated} دفعة موجودة، وتخطي ${r.skipped} (موجودة ومكتملة).` +
          (r.errors.length ? " أخطاء: " + r.errors.join(" | ") : ""),
      });
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  function manualRows(): ImportRow[] {
    return records
      .map((r) => {
        const o: Record<string, string> = {};
        for (const f of FIELDS) {
          const col = map[f.key];
          if (col && r[col] !== undefined && r[col] !== "") o[f.key] = String(r[col]).trim();
        }
        return o as unknown as ImportRow;
      })
      .filter((o) => o.ziinaIntentId && o.amount);
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

  const ziinaTotal = ziina?.rows.reduce((s, r) => s + Number(r.amount), 0) ?? 0;
  const ziinaFees = ziina?.rows.reduce((s, r) => s + Number(r.fee ?? 0), 0) ?? 0;
  const skippedText = ziina
    ? Object.entries(ziina.skipped)
        .map(([t, n]) => `${n} ${t === "Withdrawal" ? "سحب (Withdrawal)" : t}`)
        .join("، ")
    : "";

  return (
    <div className="mx-auto max-w-4xl space-y-5">
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
        <h2 className="font-semibold">استيراد ملف CSV</h2>
        <p className="text-sm text-gray-500">
          ملف المعاملات المُصدَّر من Ziina يُقرأ تلقائيًا (بما فيه رقم الطلب والرسوم الفعلية)، وتُستبعد السحوبات. الدفعات
          الموجودة مسبقًا لا تتكرر، بل تُستكمل بياناتها الناقصة فقط.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />

        {ziina && (
          <div className="space-y-3">
            <Alert tone="success">
              تم التعرف على ملف Ziina: <b className="num">{ziina.rows.length}</b> دفعة من العملاء بإجمالي{" "}
              <b className="num">{ziinaTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED</b> (رسوم{" "}
              <span className="num">{ziinaFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>)
              {skippedText && <> — سيتم تجاهل: {skippedText}</>}
            </Alert>
            {ziina.problems.length > 0 && <Alert tone="error">ملاحظات: {ziina.problems.join(" | ")}</Alert>}
            <div className="max-h-96 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50">
                  <tr className="text-right">
                    <th className="p-2">التاريخ</th>
                    <th className="p-2">رقم الطلب</th>
                    <th className="p-2">العميل</th>
                    <th className="p-2">الإيميل</th>
                    <th className="p-2">المبلغ</th>
                    <th className="p-2">الرسوم</th>
                  </tr>
                </thead>
                <tbody>
                  {ziina.rows.map((r) => (
                    <tr key={r.ziinaIntentId} className="border-t">
                      <td className="num p-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="num p-2">{r.orderNumber ? `#${r.orderNumber}` : "—"}</td>
                      <td className="p-2">{r.customerName ?? "—"}</td>
                      <td className="num p-2">{r.customerEmail ?? "—"}</td>
                      <td className="num p-2 whitespace-nowrap">{Number(r.amount).toFixed(2)}</td>
                      <td className="num p-2">{Number(r.fee).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button loading={busy} disabled={!ziina.rows.length} onClick={() => send(ziina.rows)}>
              استيراد {ziina.rows.length} دفعة
            </Button>
          </div>
        )}

        {!ziina && headers.length > 0 && (
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
                  {records.slice(0, 5).map((r, i) => (
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
            <div className="text-sm text-gray-500">عدد الأسطر: {records.length} (معاينة أول 5)</div>
            <Button loading={busy} disabled={!map.ziinaIntentId || !map.amount} onClick={() => send(manualRows())}>
              استيراد
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
