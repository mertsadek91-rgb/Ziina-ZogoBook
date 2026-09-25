// Reads a bank statement CSV (built for Wio Business, tolerant of other banks) and suggests how
// each line should be booked. Pure functions: used in the browser and covered by unit tests.

import type { EntryKind } from "./ledger-calc";

export type ColumnKey = "date" | "description" | "amount" | "debit" | "credit" | "balance" | "reference" | "notes" | "type";

export type ColumnMap = Partial<Record<ColumnKey, string>>;

// Wio Business export columns: Account name, Account type, Account IBAN, Account number, Card number,
// Account currency, Transaction type, Date, Ref. number, Description, Amount, Balance,
// Original ref. number, Notes.
const GUESSES: Record<ColumnKey, RegExp> = {
  date: /^(transaction |value |posting |booking )?date( ?time)?$|^التاريخ/i,
  description: /description|details|narrative|particulars|merchant|transaction$|^البيان|الوصف/i,
  amount: /^(transaction )?amount( \(aed\))?$|^amount aed$|^المبلغ$/i,
  debit: /debit|withdrawal|money out|paid out|مدين|سحب/i,
  credit: /credit|deposit|money in|paid in|دائن|إيداع/i,
  balance: /balance|الرصيد/i,
  // "Ref. number" (not "Original ref. number", which is N/A on Wio statements)
  reference: /^(ref\.?|reference)( ?(number|no\.?|#))?$|^transaction id$|^المرجع/i,
  notes: /^notes?$|memo|remarks|ملاحظات/i,
  type: /^(transaction )?type$|^category$|^النوع/i,
};

export function guessColumns(headers: string[]): ColumnMap {
  const map: ColumnMap = {};
  const used = new Set<string>();
  // Order matters: specific columns first so "Balance" is not taken as amount, etc.
  for (const key of ["balance", "debit", "credit", "reference", "type", "notes", "date", "amount", "description"] as ColumnKey[]) {
    const h = headers.find((x) => !used.has(x) && GUESSES[key].test(x.trim()));
    if (h) {
      map[key] = h;
      used.add(h);
    }
  }
  return map;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

/**
 * Parses statement dates in Dubai time: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY, YYYY-MM-DD,
 * "25 Sep 2026", "25-Sep-2026", each with an optional time. Never guesses MM/DD.
 */
export function parseBankDate(raw?: string): string | undefined {
  const s = (raw ?? "").trim();
  if (!s) return undefined;
  const time = (h = "0", mi = "0", sec = "0") => `T${h.padStart(2, "0")}:${mi.padStart(2, "0")}:${sec.padStart(2, "0")}+04:00`;
  const iso = (y: string, mo: number, d: number) =>
    mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}` : undefined;
  const T = "(?:[ T,]+(\\d{1,2}):(\\d{2})(?::(\\d{2}))?)?";

  let m = s.match(new RegExp(`^(\\d{4})-(\\d{1,2})-(\\d{1,2})${T}`));
  if (m) {
    const d = iso(m[1], +m[2], +m[3]);
    return d && d + time(m[4], m[5], m[6]);
  }
  m = s.match(new RegExp(`^(\\d{1,2})[/.-](\\d{1,2})[/.-](\\d{4})${T}`));
  if (m) {
    const d = iso(m[3], +m[2], +m[1]);
    return d && d + time(m[4], m[5], m[6]);
  }
  m = s.match(new RegExp(`^(\\d{1,2})[\\s-]([A-Za-z]{3,4})[a-z]*[\\s,-]*(\\d{4})${T}`));
  if (m && MONTHS[m[2].toLowerCase()]) {
    const d = iso(m[3], MONTHS[m[2].toLowerCase()], +m[1]);
    return d && d + time(m[4], m[5], m[6]);
  }
  return undefined;
}

/** "1,234.50", "-1,234.50", "(1,234.50)", "AED 1,234.50", "1,234.50 CR" → number (negative = money out). */
export function parseAmount(raw?: string): number | undefined {
  let s = (raw ?? "").trim();
  if (!s) return undefined;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (/\bDR\b/i.test(s)) sign = -1;
  s = s.replace(/\b(AED|CR|DR)\b/gi, "").replace(/[,\s]/g, "");
  if (s.startsWith("-")) {
    sign *= -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  const n = Number(s);
  return Number.isFinite(n) ? sign * n : undefined;
}

/** Small deterministic hash (browser-safe) used to recognise statement lines already imported. */
function hash(s: string): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 2246822519) >>> 0;
  }
  return h1.toString(16).padStart(8, "0") + h2.toString(16).padStart(8, "0");
}

export interface BankLine {
  date: string; // ISO with +04:00
  amountFils: number; // signed: + money in, − money out
  description: string; // bank description (used for classification)
  notes?: string; // extra bank notes (e.g. Wio "Cash out transfer for operation …")
  type?: string; // bank transaction type (e.g. Wio "Transfers", "Fees")
  reference?: string;
  balanceFils?: number;
  externalId: string;
}

export interface ParseResult {
  lines: BankLine[]; // always oldest → newest
  problems: string[];
  openingBalanceFils?: number; // balance before the first line (from the running balance)
  closingBalanceFils?: number; // balance after the last line
  closingDate?: string;
}

const fils = (n: number) => Math.round(n * 100);

/** Empty-ish cell values used by bank exports. */
const clean = (v?: string) => {
  const s = (v ?? "").trim();
  return !s || /^(n\/a|na|null|undefined|-)$/i.test(s) ? undefined : s;
};

/** Text stored with an imported entry: description + notes when they add information. */
export function lineText(l: BankLine): string {
  return l.notes && l.notes !== l.description ? `${l.description} — ${l.notes}` : l.description;
}

export function parseStatement(records: Record<string, string>[], map: ColumnMap): ParseResult {
  let lines: BankLine[] = [];
  const problems: string[] = [];
  const seen = new Map<string, number>();

  records.forEach((r, i) => {
    const rowNo = i + 2;
    const date = parseBankDate(map.date ? r[map.date] : undefined);
    let amount: number | undefined;
    if (map.amount) amount = parseAmount(r[map.amount]);
    else {
      const debit = map.debit ? parseAmount(r[map.debit]) : undefined;
      const credit = map.credit ? parseAmount(r[map.credit]) : undefined;
      if (debit || credit) amount = (credit ? Math.abs(credit) : 0) - (debit ? Math.abs(debit) : 0);
    }
    const description = clean(map.description ? r[map.description] : undefined) ?? "";
    if (!date && amount === undefined && !description) return; // blank / footer line
    if (!date) {
      problems.push(`سطر ${rowNo}: تاريخ غير مفهوم "${map.date ? r[map.date] : ""}"`);
      return;
    }
    if (amount === undefined || amount === 0) {
      if (amount === undefined) problems.push(`سطر ${rowNo}: مبلغ غير مفهوم`);
      return;
    }
    const balance = map.balance ? parseAmount(clean(r[map.balance])) : undefined;
    const reference = map.reference ? clean(r[map.reference]) : undefined;
    // A bank reference number is unique per transaction → the most reliable duplicate key
    // (works across overlapping statements). Otherwise hash the line's content.
    let externalId: string;
    if (reference) externalId = `bank:ref:${reference}`.slice(0, 80);
    else {
      const base = [date.slice(0, 10), fils(amount), description.toLowerCase(), balance ?? ""].join("|");
      // Identical lines in one file (same day, amount, text) are distinct transactions: number them.
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      externalId = `bank:${hash(base)}:${n}`;
    }
    lines.push({
      date,
      amountFils: fils(amount),
      description,
      notes: map.notes ? clean(r[map.notes]) : undefined,
      type: map.type ? clean(r[map.type]) : undefined,
      reference,
      balanceFils: balance !== undefined ? fils(balance) : undefined,
      externalId,
    });
  });

  // Statements can be newest-first; normalise to oldest → newest.
  if (lines.length > 1 && lines[0].date > lines[lines.length - 1].date) lines = lines.reverse();

  // Running-balance check: each balance must equal the previous balance + the amount.
  // A mismatch means a missing line (e.g. an incomplete export) or a mis-read amount.
  let opening: number | undefined;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.balanceFils === undefined) continue;
    if (i === 0) opening = l.balanceFils - l.amountFils;
    const prev = lines[i - 1];
    if (prev?.balanceFils !== undefined && prev.balanceFils + l.amountFils !== l.balanceFils) {
      problems.push(
        `الرصيد غير متسلسل عند ${l.date.slice(0, 10)} (${l.description}): المتوقع ${((prev.balanceFils + l.amountFils) / 100).toFixed(2)} والكشف يقول ${(l.balanceFils / 100).toFixed(2)}`,
      );
    }
  }
  const last = [...lines].reverse().find((l) => l.balanceFils !== undefined);
  return {
    lines,
    problems,
    openingBalanceFils: opening,
    closingBalanceFils: last?.balanceFils,
    closingDate: last?.date,
  };
}

// ---------- Suggested booking ----------

export interface ClassifyContext {
  bankAccountId: string;
  gatewayAccountId?: string; // Ziina
  stripeAccountId?: string; // Stripe payouts arrive via Network International
  partners: { id: string; name: string }[];
}

export interface Suggestion {
  kind: EntryKind;
  fromAccountId?: string;
  toAccountId?: string;
  category?: string;
}

const FEE = /\bfees?\b|charge|commission|\bvat\b|رسوم|عمولة/i;
const ADS = /facebook|\bmeta\b|fb\.me|google ?ads|google\*ads|tiktok|snap(chat)?|linkedin ads|twitter ads|\bx ads\b/i;
const SUBS = /openai|chatgpt|anthropic|claude|adobe|canva|figma|notion|slack|zoom|microsoft|office ?365|google (workspace|gsuite)|apple\.com|icloud|aws|amazon web|vercel|hostinger|godaddy|namecheap|cloudflare|github|zoho|shopify|wati|mailchimp|capcut|envato/i;
const GOV = /government|\bgov\b|ded\b|freezone|free zone|tasheel|amer|icp|emirates id|visa fee|trade licen/i;

function partnerMatch(desc: string, name: string): boolean {
  const tokens = name.toLowerCase().split(/\s+/).filter((t) => t.length >= 3);
  const d = desc.toLowerCase();
  return tokens.some((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(d));
}

export function suggestBooking(line: BankLine, ctx: ClassifyContext): Suggestion {
  const d = line.description;
  const bank = ctx.bankAccountId;
  const incoming = line.amountFils > 0;

  // Stripe payouts to a UAE bank show as "From NETWORK INTERNATIONAL LLC" with a STRIPE-… note.
  if (incoming && ctx.stripeAccountId && /stripe|network international/i.test(`${d} ${line.notes ?? ""}`)) {
    return { kind: "transfer", fromAccountId: ctx.stripeAccountId, toAccountId: bank };
  }
  if (incoming && ctx.gatewayAccountId && /ziina/i.test(d)) {
    return { kind: "transfer", fromAccountId: ctx.gatewayAccountId, toAccountId: bank };
  }
  const partner = ctx.partners.find((p) => partnerMatch(d, p.name));
  if (partner) {
    return incoming
      ? { kind: "transfer", fromAccountId: partner.id, toAccountId: bank }
      : { kind: "transfer", fromAccountId: bank, toAccountId: partner.id };
  }
  if (incoming) return { kind: "income", toAccountId: bank };
  // Wio marks its own charges (subscription, transfer fees) with transaction type "Fees".
  if (FEE.test(d) || /^fees?$|^charges?$/i.test(line.type ?? "")) return { kind: "bank_fee", fromAccountId: bank };
  if (ADS.test(d)) return { kind: "expense", fromAccountId: bank, category: "ads" };
  if (SUBS.test(d)) return { kind: "expense", fromAccountId: bank, category: "subscriptions" };
  if (GOV.test(d)) return { kind: "expense", fromAccountId: bank, category: "government" };
  return { kind: "expense", fromAccountId: bank, category: "other" };
}
