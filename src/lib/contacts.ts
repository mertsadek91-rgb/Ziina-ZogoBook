import type { ZohoContact } from "./zoho";

export function normalizePhone(p?: string | null): string {
  return (p ?? "").replace(/\D/g, "").replace(/^00/, "").slice(-9);
}

/** Pick the best existing Zoho contact for a customer. Exact matches only. */
export function matchContact(
  candidates: ZohoContact[],
  customer: { name?: string | null; email?: string | null; phone?: string | null },
): ZohoContact | undefined {
  const email = customer.email?.trim().toLowerCase();
  if (email) {
    const byEmail = candidates.find((c) => c.email?.trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  const phone = normalizePhone(customer.phone);
  if (phone.length >= 7) {
    const byPhone = candidates.find(
      (c) => normalizePhone(c.phone) === phone || normalizePhone(c.mobile) === phone,
    );
    if (byPhone) return byPhone;
  }
  const name = customer.name?.trim().toLowerCase();
  if (name) return candidates.find((c) => c.contact_name.trim().toLowerCase() === name);
  return undefined;
}
