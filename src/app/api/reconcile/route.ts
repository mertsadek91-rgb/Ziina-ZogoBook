import { NextResponse } from "next/server";
import { z } from "zod";
import { reconcile } from "@/lib/reconcile";
import { jsonError } from "@/lib/api";

const Schema = z.object({ sinceDays: z.number().int().min(1).max(730).optional() });

/** Check all completed payments in the period against Zoho Books. */
export async function POST(req: Request) {
  try {
    const { sinceDays } = Schema.parse(await req.json().catch(() => ({})));
    return NextResponse.json({ summary: await reconcile({ sinceDays: sinceDays ?? 90 }) });
  } catch (err) {
    return jsonError(err, 502);
  }
}
