// Minimal read-only WooCommerce REST client (wc/v3). Use a key with "Read" permission only:
// WooCommerce → Settings → Advanced → REST API → Add key.

export class WooError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export function wooConfigured(): boolean {
  return !!(process.env.WOO_URL && process.env.WOO_CONSUMER_KEY && process.env.WOO_CONSUMER_SECRET);
}

export interface WooOrder {
  id: number;
  number: string;
  status: string; // pending | processing | on-hold | completed | cancelled | refunded | failed | checkout-draft
  currency: string;
  total: string;
  date_created_gmt: string | null;
  date_paid_gmt: string | null;
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  billing?: { first_name?: string; last_name?: string; email?: string; phone?: string };
  meta_data?: { key: string; value: unknown }[];
}

/** Woo order statuses that mean the customer paid. */
export const WOO_PAID = new Set(["processing", "completed", "refunded"]);

async function get(path: string, query: Record<string, string>, basic: boolean): Promise<Response> {
  const base = (process.env.WOO_URL ?? "").replace(/\/$/, "");
  const key = process.env.WOO_CONSUMER_KEY ?? "";
  const secret = process.env.WOO_CONSUMER_SECRET ?? "";
  const qs = new URLSearchParams(query);
  // Some hosts strip the Authorization header; WooCommerce also accepts the keys as query params over HTTPS.
  if (!basic) {
    qs.set("consumer_key", key);
    qs.set("consumer_secret", secret);
  }
  return fetch(`${base}/wp-json/wc/v3${path}?${qs}`, {
    headers: basic ? { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString("base64")}` } : undefined,
    cache: "no-store",
  });
}

/** Orders paid (or attempted) with the Ziina plugin, oldest first. `after` limits by creation date. */
export async function listZiinaOrders(after?: Date): Promise<WooOrder[]> {
  if (!wooConfigured()) throw new WooError("لم يتم ضبط ربط الموقع (WOO_URL / WOO_CONSUMER_KEY / WOO_CONSUMER_SECRET)");
  const all: WooOrder[] = [];
  let basic = true;
  for (let page = 1; page <= 200; page++) {
    const query: Record<string, string> = { per_page: "100", page: String(page), orderby: "date", order: "asc" };
    if (after) query.after = after.toISOString().slice(0, 19);
    let res = await get("/orders", query, basic);
    if (res.status === 401 && basic) {
      basic = false;
      res = await get("/orders", query, basic);
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { message?: string } | null;
      throw new WooError(`WooCommerce: ${body?.message ?? `HTTP ${res.status}`}`, res.status);
    }
    const rows = (await res.json()) as WooOrder[];
    for (const o of rows) {
      // The official Ziina plugin stores the payment intent id as the order's transaction id.
      if (/ziina/i.test(o.payment_method) && o.transaction_id) all.push(o);
    }
    const pages = Number(res.headers.get("x-wp-totalpages") ?? "1");
    if (page >= pages || rows.length === 0) break;
  }
  return all;
}
