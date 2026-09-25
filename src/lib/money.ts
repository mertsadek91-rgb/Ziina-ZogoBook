// Amounts are stored in the currency's base (minor) units, as Ziina expects: 1 AED = 100 fils,
// 1 KWD = 1000 fils. Settled payments are always AED; unpaid links keep the currency they were created in.

/** Currencies Ziina accepts for payment links (docs.ziina.com/supported-currencies). */
export const CURRENCIES = [
  { code: "AED", label: "درهم إماراتي" },
  { code: "SAR", label: "ريال سعودي" },
  { code: "USD", label: "دولار أمريكي" },
  { code: "EUR", label: "يورو" },
  { code: "GBP", label: "جنيه إسترليني" },
  { code: "QAR", label: "ريال قطري" },
  { code: "KWD", label: "دينار كويتي" },
  { code: "BHD", label: "دينار بحريني" },
  { code: "OMR", label: "ريال عماني" },
  { code: "INR", label: "روبية هندية" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];

const THREE_DECIMALS = new Set(["BHD", "KWD", "OMR"]);

export function decimalsOf(currency = "AED"): number {
  return THREE_DECIMALS.has(currency.toUpperCase()) ? 3 : 2;
}

/**
 * Convert a typed amount to base units for a currency. Three-decimal currencies must be rounded
 * to the nearest ten base units (e.g. 1.234 OMR → 1230), as Ziina requires.
 */
export function toMinor(amount: number | string, currency = "AED"): number {
  const n = typeof amount === "string" ? Number(amount.replace(/,/g, "")) : amount;
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${amount}`);
  const d = decimalsOf(currency);
  const units = Math.round(n * 10 ** d);
  return d === 3 ? Math.round(units / 10) * 10 : units;
}

export function fromMinor(units: number, currency = "AED"): number {
  const d = decimalsOf(currency);
  return Math.round(units) / 10 ** d;
}

/** AED helpers (settled amounts, Zoho invoices, CSV import). */
export function toFils(amount: number | string): number {
  return toMinor(amount, "AED");
}

export function fromFils(fils: number): number {
  return fromMinor(fils, "AED");
}

export function formatMoney(units: number, currency = "AED"): string {
  const d = decimalsOf(currency);
  return `${fromMinor(units, currency).toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })} ${currency}`;
}

export const MIN_AMOUNT_FILS = 200; // Ziina minimum: 2 AED
