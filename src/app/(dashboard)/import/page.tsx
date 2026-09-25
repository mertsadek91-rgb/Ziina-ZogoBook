"use client";

import { useState } from "react";
import Papa from "papaparse";
import {
  UploadCloud,
  FileSpreadsheet,
  Search,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  FileCheck,
  Hash,
} from "lucide-react";
import { Alert, Button, Card, Badge } from "@/components/ui";
import { api } from "@/components/fetcher";
import { isZiinaExport, mapZiinaExport, type ImportRow, type ZiinaMapResult } from "@/lib/ziina-csv";
import { useI18n } from "@/lib/i18n";

const FIELDS = [
  { key: "ziinaIntentId", labelAr: "رقم العملية / ID *", labelEn: "Intent ID / Ref *", guess: ["id", "payment id", "transaction id", "reference", "payment_intent_id"] },
  { key: "amount", labelAr: "المبلغ *", labelEn: "Amount *", guess: ["amount", "gross", "total", "value"] },
  { key: "fee", labelAr: "الرسوم", labelEn: "Fee", guess: ["fee", "fees", "commission"] },
  { key: "status", labelAr: "الحالة", labelEn: "Status", guess: ["status", "state"] },
  { key: "date", labelAr: "التاريخ", labelEn: "Date", guess: ["date", "created", "created at", "time"] },
  { key: "message", labelAr: "الوصف", labelEn: "Description", guess: ["message", "description", "note", "notes"] },
  { key: "orderNumber", labelAr: "رقم الطلب", labelEn: "Order Number", guess: ["order", "order number", "order #", "invoice number"] },
  { key: "customerName", labelAr: "اسم العميل", labelEn: "Customer Name", guess: ["name", "customer", "customer name", "payer"] },
  { key: "customerEmail", labelAr: "الإيميل", labelEn: "Email", guess: ["email", "customer email"] },
  { key: "customerPhone", labelAr: "الهاتف", labelEn: "Phone", guess: ["phone", "mobile", "customer phone", "customer phone number"] },
] as const;

type Key = (typeof FIELDS)[number]["key"];

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dubai", dateStyle: "short", timeStyle: "short" }) : "—";

export default function ImportPage() {
  const { t, lang, dir } = useI18n();
  const [headers, setHeaders] = useState<string[]>([]);
  const [records, setRecords] = useState<Record<string, string>[]>([]);
  const [map, setMap] = useState<Partial<Record<Key, string>>>({});
  const [ziina, setZiina] = useState<ZiinaMapResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const [trackId, setTrackId] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);

  function onFile(file: File) {
    setFileName(file.name);
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
      const text =
        lang === "ar"
          ? `تمت إضافة ${r.created} دفعة، واستكمال بيانات ${r.updated} دفعة موجودة، وتخطي ${r.skipped} (موجودة ومكتملة).` +
            (r.errors.length ? " أخطاء: " + r.errors.join(" | ") : "")
          : `Added ${r.created} payments, updated ${r.updated} existing payments, skipped ${r.skipped} (already complete).` +
            (r.errors.length ? " Errors: " + r.errors.join(" | ") : "");

      setMsg({
        tone: r.errors.length ? "error" : "success",
        text,
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
        .map(([type, n]) => `${n} ${type === "Withdrawal" ? (lang === "ar" ? "سحب نقد" : "Withdrawals") : type}`)
        .join("، ")
    : "";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.import_page_title}</h1>
        <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">{t.csv_import_desc}</p>
      </div>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {/* 2-Column Responsive Layout: Single Intent Lookup (4 cols) & CSV Import (8 cols) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Track Single Payment by Intent ID */}
        <div className="lg:col-span-4">
          <Card className="h-full flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand font-bold">
                  <Hash className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">{t.track_intent_title}</h2>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">{t.track_intent_desc}</p>

              <div>
                <label>{t.ziina_id}</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
                  <input
                    dir="ltr"
                    value={trackId}
                    onChange={(e) => setTrackId(e.target.value)}
                    placeholder={t.track_intent_placeholder}
                    className="ps-9 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            <Button
              loading={trackBusy}
              disabled={!trackId.trim()}
              onClick={track}
              variant="secondary"
              className="w-full"
            >
              <Search className="h-4 w-4" />
              <span>{t.track_intent_btn}</span>
            </Button>
          </Card>
        </div>

        {/* Right Column: CSV Statement Import */}
        <div className="lg:col-span-8">
          <Card className="space-y-5">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 font-bold">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">{t.csv_import_title}</h2>
                <span className="text-[11px] text-slate-400">
                  {lang === "ar" ? "يدعم كشوف حساب Ziina الرسمية وملفات CSV المخصصة" : "Supports official Ziina statements & custom CSV"}
                </span>
              </div>
            </div>

            {/* Drag & Drop Styled File Upload Box */}
            <label className="group flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center hover:border-brand hover:bg-brand-50/20 transition cursor-pointer">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-xs text-slate-500 group-hover:text-brand group-hover:scale-105 transition">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div className="mt-3 text-xs font-bold text-slate-700 group-hover:text-brand">
                {t.drag_drop_csv}
              </div>
              <div className="mt-1 text-[11px] text-slate-400">.CSV files only</div>
              {fileName && (
                <div className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200">
                  <FileCheck className="h-3.5 w-3.5" />
                  <span>{fileName}</span>
                </div>
              )}
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>

            {/* Official Ziina Export Recognition Panel */}
            {ziina && (
              <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-2xs">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>
                    {t.ziina_export_detected}: <b className="num text-emerald-950">{ziina.rows.length}</b>{" "}
                    {lang === "ar" ? "دفعة بإجمالي" : "payments totaling"}{" "}
                    <b className="num">{ziinaTotal.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED</b> (
                    {lang === "ar" ? "رسوم:" : "fees:"}{" "}
                    <span className="num">{ziinaFees.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>)
                  </span>
                </div>

                {skippedText && (
                  <div className="text-xs text-emerald-800">
                    <span className="font-semibold">{t.skipped_withdrawals}</span> {skippedText}
                  </div>
                )}

                {ziina.problems.length > 0 && (
                  <Alert tone="error">
                    {lang === "ar" ? "ملاحظات:" : "Notes:"} {ziina.problems.join(" | ")}
                  </Alert>
                )}

                {/* Preview Table */}
                <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-2xs">
                  <table className="w-full text-start text-xs">
                    <thead className="sticky top-0 bg-slate-50 border-b border-slate-100 font-semibold text-slate-500">
                      <tr>
                        <th className="p-2.5 text-start">{t.col_date}</th>
                        <th className="p-2.5 text-start">{t.order_number}</th>
                        <th className="p-2.5 text-start">{t.col_customer}</th>
                        <th className="p-2.5 text-start">{t.customer_email}</th>
                        <th className="p-2.5 text-start">{t.col_amount}</th>
                        <th className="p-2.5 text-start">{t.ziina_fees}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ziina.rows.map((r) => (
                        <tr key={r.ziinaIntentId} className="hover:bg-slate-50">
                          <td className="num p-2.5 whitespace-nowrap text-slate-600">{fmtDate(r.date)}</td>
                          <td className="num p-2.5 font-bold text-slate-700">{r.orderNumber ? `#${r.orderNumber}` : "—"}</td>
                          <td className="p-2.5 font-medium text-slate-800">{r.customerName ?? "—"}</td>
                          <td className="num p-2.5 text-slate-500">{r.customerEmail ?? "—"}</td>
                          <td className="num p-2.5 font-bold text-slate-900">{Number(r.amount).toFixed(2)}</td>
                          <td className="num p-2.5 text-slate-500">{Number(r.fee).toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <Button loading={busy} disabled={!ziina.rows.length} size="lg" onClick={() => send(ziina.rows)} className="w-full">
                  <FileCheck className="h-4 w-4" />
                  <span>
                    {t.execute_import} ({ziina.rows.length})
                  </span>
                </Button>
              </div>
            )}

            {/* Custom CSV Mapping Fallback */}
            {!ziina && headers.length > 0 && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {FIELDS.map((f) => (
                    <div key={f.key}>
                      <label>{lang === "ar" ? f.labelAr : f.labelEn}</label>
                      <select
                        value={map[f.key] ?? ""}
                        onChange={(e) => setMap({ ...map, [f.key]: e.target.value || undefined })}
                        className="text-xs"
                      >
                        <option value="">— {t.ignore_column} —</option>
                        {headers.map((h) => (
                          <option key={h} value={h}>
                            {h}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 border-b font-semibold text-slate-500">
                      <tr>
                        {FIELDS.filter((f) => map[f.key]).map((f) => (
                          <th key={f.key} className="p-2.5 text-start">
                            {lang === "ar" ? f.labelAr : f.labelEn}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {records.slice(0, 5).map((r, i) => (
                        <tr key={i} className="hover:bg-slate-50">
                          {FIELDS.filter((f) => map[f.key]).map((f) => (
                            <td key={f.key} className="p-2.5">
                              {r[map[f.key]!]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{t.records_count} {records.length}</span>
                </div>

                <Button
                  loading={busy}
                  disabled={!map.ziinaIntentId || !map.amount}
                  size="lg"
                  onClick={() => send(manualRows())}
                  className="w-full"
                >
                  <FileCheck className="h-4 w-4" />
                  <span>{t.execute_import}</span>
                </Button>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
