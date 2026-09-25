import { NextResponse } from "next/server";
import { listDepositAccounts } from "@/lib/zoho";
import { jsonError } from "@/lib/api";

export async function GET() {
  try {
    return NextResponse.json({ accounts: await listDepositAccounts() });
  } catch (err) {
    return jsonError(err, 502);
  }
}
