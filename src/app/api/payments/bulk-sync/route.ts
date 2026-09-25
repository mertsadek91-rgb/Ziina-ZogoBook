import { NextResponse } from "next/server";
import { z } from "zod";
import { syncToZoho } from "@/lib/sync";
import { jsonError } from "@/lib/api";

const Schema = z.object({
  ids: z.array(z.string()).min(1).max(50),
  itemId: z.string().min(1),
  itemName: z.string().optional(),
  sendEmail: z.boolean().default(false),
});

export async function POST(req: Request) {
  try {
    const { ids, ...opts } = Schema.parse(await req.json());
    const results = [];
    // Sequential on purpose: respects Zoho's rate and concurrency limits.
    for (const id of ids) {
      const r = await syncToZoho(id, opts);
      results.push({ id, ok: r.ok, error: r.error });
    }
    return NextResponse.json({ results });
  } catch (err) {
    return jsonError(err);
  }
}
