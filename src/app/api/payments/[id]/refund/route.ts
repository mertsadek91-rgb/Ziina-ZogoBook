import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { refundToSettledFils, setRefunded } from "@/lib/refund";

/** Record the total refunded part of a payment (e.g. a partial refund made in the Ziina app). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = z
      .object({ amount: z.coerce.number().min(0), currency: z.string().min(3).max(3) })
      .parse(await req.json());
    const p = await prisma.payment.findUniqueOrThrow({ where: { id } });
    if (p.gateway === "stripe") throw new Error("استردادات Stripe تُقرأ تلقائيًا من Stripe");
    const fils = refundToSettledFils(p, body.amount, body.currency);
    const detail =
      body.currency === "AED"
        ? `تسجيل استرداد يدوي: إجمالي ${formatMoney(fils, "AED")}`
        : `تسجيل استرداد يدوي: إجمالي ${body.amount} ${body.currency} = ${formatMoney(fils, "AED")}`;
    return NextResponse.json({ payment: await setRefunded(p.id, fils, detail) });
  } catch (err) {
    return jsonError(err);
  }
}
