// Recognises the transactions CSV exported from the Ziina dashboard/app and maps it to import rows.
// Pure functions: used by the import page in the browser and covered by unit tests.

export interface ImportRow {
  ziinaIntentId: string;
  amount: string; // AED, gross ("Amount")
  fee?: string; // AED actually charged = Fee − Waived Fee
  tip?: string;
  status?: string;
  date?: string; // ISO 8601 with Dubai offset
  message?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  orderNumber?: string;
  cardLast4?: string;
}

const REQUIRED = ["Transaction ID", "Type", "Amount", "Amount Received", "Fee", "Invoice Number"];

export function isZiinaExport(headers: string[]): boolean {
  const set = new Set(headers.map((h) => h.trim()));
  return REQUIRED.every((h) => set.has(h));
}

/** Types that are money received from a customer. Anything else (Withdrawal, Refund, Transfer…) is skipped. */
function isIncomingPayment(type: string): boolean {
  const t = type.trim().toLowerCase();
  if (/withdraw|cash ?out|refund|transfer|top ?up|payout|fee/.test(t)) return false;
  return /invoice|payment|link|order/.test(t);
}

/** "25/09/2026 01:15:32" (DD/MM/YYYY, Dubai time) → "2026-09-25T01:15:32+04:00". */
export function parseZiinaDate(s?: string): string | undefined {
  const m = (s ?? "").trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return undefined;
  const [, d, mo, y, h = "0", mi = "0", sec = "0"] = m;
  const p = (v: string) => v.padStart(2, "0");
  if (Number(mo) > 12 || Number(d) > 31) return undefined;
  return `${y}-${p(mo)}-${p(d)}T${p(h)}:${p(mi)}:${p(sec)}+04:00`;
}

const num = (v?: string) => {
  const n = Number((v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
};
const clean = (v?: string) => {
  const s = (v ?? "").trim();
  return !s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null" ? undefined : s;
};

export interface ZiinaMapResult {
  rows: ImportRow[];
  skipped: Record<string, number>; // by Type
  problems: string[];
}

export function mapZiinaExport(records: Record<string, string>[]): ZiinaMapResult {
  const rows: ImportRow[] = [];
  const skipped: Record<string, number> = {};
  const problems: string[] = [];

  records.forEach((r, i) => {
    const type = (r["Type"] ?? "").trim();
    if (!isIncomingPayment(type)) {
      skipped[type || "(بدون نوع)"] = (skipped[type || "(بدون نوع)"] ?? 0) + 1;
      return;
    }
    const id = clean(r["Transaction ID"]);
    if (!id) {
      problems.push(`سطر ${i + 2}: لا يوجد Transaction ID`);
      return;
    }
    const currency = clean(r["Currency"]) ?? "AED";
    if (currency !== "AED") problems.push(`سطر ${i + 2}: العملة ${currency} وليست AED`);
    const date = parseZiinaDate(r["Time"]);
    if (!date) problems.push(`سطر ${i + 2}: تاريخ غير مفهوم "${r["Time"]}"`);

    const fee = Math.max(0, Math.round((num(r["Fee"]) - num(r["Waived Fee"])) * 100) / 100);
    const card = (r["Customer Card Number"] ?? "").match(/(\d{4})\s*$/);

    rows.push({
      ziinaIntentId: id,
      amount: String(num(r["Amount"])),
      fee: String(fee),
      tip: String(num(r["Tip"])),
      status: "completed",
      date,
      message: clean(r["Message"]),
      customerName: clean(r["Customer"]) ?? clean(r["Customer Username"]),
      customerEmail: clean(r["Customer Email"]),
      customerPhone: clean(r["Customer Phone Number"]),
      orderNumber: clean(r["Invoice Number"]),
      cardLast4: card?.[1],
    });
  });
  return { rows, skipped, problems };
}
