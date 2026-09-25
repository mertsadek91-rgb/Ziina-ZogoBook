import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";

const Schema = z.object({ archived: z.boolean() });

/** Hide (archive) or restore a payment. Hidden payments leave all tabs, totals and Zoho checks. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { archived } = Schema.parse(await req.json());
    const payment = await prisma.payment.update({ where: { id }, data: { archived } });
    await prisma.syncLog.create({
      data: { paymentId: id, step: "archive", success: true, detail: archived ? "تم إخفاء الدفعة" : "تم إظهار الدفعة" },
    });
    return NextResponse.json({ payment });
  } catch (err) {
    return jsonError(err);
  }
}
