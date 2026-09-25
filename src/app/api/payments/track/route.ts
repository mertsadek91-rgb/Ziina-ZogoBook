import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { getPaymentIntent, intentToPaymentFields } from "@/lib/ziina";
import { jsonError } from "@/lib/api";

/** Start tracking an existing Ziina payment intent by its ID (e.g. one created elsewhere). */
const Schema = z.object({
  intentId: z.string().min(1),
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const input = Schema.parse(await req.json());
    const pi = await getPaymentIntent(input.intentId.trim());
    const { createdAtZiina, ...fields } = intentToPaymentFields(pi);
    const payment = await prisma.payment.upsert({
      where: { ziinaIntentId: pi.id },
      update: fields,
      create: {
        ziinaIntentId: pi.id,
        ...fields,
        createdAt: createdAtZiina ?? undefined,
        paidAt: pi.status === "completed" ? (createdAtZiina ?? new Date()) : null,
        customerName: input.customerName || null,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone || null,
        source: "api",
      },
    });
    return NextResponse.json({ payment });
  } catch (err) {
    return jsonError(err);
  }
}
