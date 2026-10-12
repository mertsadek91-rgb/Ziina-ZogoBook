import { NextResponse } from "next/server";
import { accountingStatement } from "@/lib/ledger";
import { dubaiDayEnd, dubaiDayStart } from "@/lib/ledger-dates";
import { jsonError } from "@/lib/api";

/** GET /api/accounting/statement?account=<id>&from=yyyy-mm-dd&to=yyyy-mm-dd */
export async function GET(req: Request) {
  try {
    const sp = new URL(req.url).searchParams;
    const id = sp.get("account");
    if (!id) throw new Error("اختر الحساب");
    return NextResponse.json(await accountingStatement(id, dubaiDayStart(sp.get("from")), dubaiDayEnd(sp.get("to"))));
  } catch (err) {
    return jsonError(err);
  }
}
