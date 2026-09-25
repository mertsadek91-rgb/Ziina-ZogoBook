import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { assertPartner } from "@/lib/partners";
import { jsonError } from "@/lib/api";

const Schema = z.object({ ids: z.array(z.string()).min(1).max(500), partnerAccountId: z.string().nullable() });

/** Assign (or clear) the partner of several payments at once. */
export async function POST(req: Request) {
  try {
    const { ids, partnerAccountId } = Schema.parse(await req.json());
    const partner = await assertPartner(partnerAccountId);
    const r = await prisma.payment.updateMany({ where: { id: { in: ids } }, data: { partnerAccountId: partner } });
    return NextResponse.json({ updated: r.count });
  } catch (err) {
    return jsonError(err);
  }
}
