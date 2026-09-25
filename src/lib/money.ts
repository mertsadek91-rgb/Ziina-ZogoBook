/** Ziina amounts are in the smallest unit (fils). 1 AED = 100 fils. */
export function toFils(amount: number | string): number {
  const n = typeof amount === "string" ? Number(amount.replace(/,/g, "")) : amount;
  if (!Number.isFinite(n)) throw new Error(`Invalid amount: ${amount}`);
  return Math.round(n * 100);
}

export function fromFils(fils: number): number {
  return Math.round(fils) / 100;
}

export function formatMoney(fils: number, currency = "AED"): string {
  return `${fromFils(fils).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

export const MIN_AMOUNT_FILS = 200; // Ziina minimum: 2 AED
