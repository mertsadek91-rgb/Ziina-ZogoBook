import { NextResponse } from "next/server";
import { z } from "zod";
import { syncWooOrders } from "@/lib/woo-sync";
import { jsonError } from "@/lib/api";

export const maxDuration = 300;

/** Compare the website's Ziina orders with the system and add paid ones that are missing. */
export async function POST(req: Request) {
  try {
    const body = z.object({ sinceDays: z.number().int().positive().optional() }).parse(await req.json().catch(() => ({})));
    return NextResponse.json({ report: await syncWooOrders(body.sinceDays) });
  } catch (err) {
    return jsonError(err, 502);
  }
}
