import { NextResponse } from "next/server";
import { accountingSummary } from "@/lib/ledger";
import { dubaiDayEnd, dubaiDayStart } from "@/lib/ledger-dates";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    return NextResponse.json(await accountingSummary(dubaiDayStart(sp.get("from")), dubaiDayEnd(sp.get("to"))));
  } catch (err) {
    return jsonError(err, 500);
  }
}
