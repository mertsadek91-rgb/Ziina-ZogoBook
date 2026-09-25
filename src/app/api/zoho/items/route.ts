import { NextResponse } from "next/server";
import { listItems, type ZohoItem } from "@/lib/zoho";
import { jsonError } from "@/lib/api";

let cache: { at: number; items: ZohoItem[] } | null = null;
const TTL = 10 * 60_000;

export async function GET(req: Request) {
  try {
    const force = new URL(req.url).searchParams.get("refresh") === "1";
    if (force || !cache || Date.now() - cache.at > TTL) {
      cache = { at: Date.now(), items: await listItems() };
    }
    const items = cache.items.map((i) => ({
      item_id: i.item_id,
      name: i.name,
      rate: i.rate,
      product_type: i.product_type,
      sku: i.sku,
    }));
    return NextResponse.json({ items });
  } catch (err) {
    return jsonError(err, 502);
  }
}
