/** Normalize a Ziina order number as typed by the user: "#333136", " 333136 " → "333136". */
export function normalizeOrderNumber(v?: string | null): string | null {
  const s = (v ?? "").trim().replace(/^#+/, "").trim();
  return s ? s.slice(0, 40) : null;
}

/** Text written into the Zoho invoice notes / payment description. */
export function zohoNote(externalId: string, orderNumber?: string | null, gateway: string = "ziina"): string {
  const g = gateway === "stripe" ? "Stripe" : "Ziina";
  return orderNumber ? `${g} Order #${orderNumber}\n${g} payment ${externalId}` : `${g} payment ${externalId}`;
}
