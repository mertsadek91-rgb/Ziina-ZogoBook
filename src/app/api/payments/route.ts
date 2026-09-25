import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createPaymentIntent, intentToPaymentFields } from "@/lib/ziina";
import { MIN_AMOUNT_FILS, toFils } from "@/lib/money";
import { whereForTab, type Tab } from "@/lib/status";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const tab = (searchParams.get("tab") ?? "all") as Tab;
  const payments = await prisma.payment.findMany({
    where: whereForTab(tab),
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  return NextResponse.json({ payments });
}

const CreateSchema = z.object({
  amount: z.coerce.number().positive(),
  message: z.string().max(500).optional(),
  customerName: z.string().max(200).optional(),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().max(40).optional(),
  notes: z.string().max(1000).optional(),
  expiryHours: z.coerce.number().min(0).max(24 * 90).optional(),
  test: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const input = CreateSchema.parse(await req.json());
    const amountFils = toFils(input.amount);
    if (amountFils < MIN_AMOUNT_FILS) throw new Error("الحد الأدنى للمبلغ هو 2 درهم");

    const test = input.test ?? env.ziinaTestMode();
    const pi = await createPaymentIntent({
      amountFils,
      message: input.message,
      expiryMs: input.expiryHours ? Date.now() + input.expiryHours * 3600_000 : undefined,
      test,
    });
    const { createdAtZiina, ...fields } = intentToPaymentFields(pi);
    const payment = await prisma.payment.create({
      data: {
        ziinaIntentId: pi.id,
        ...fields,
        createdAt: createdAtZiina ?? undefined,
        customerName: input.customerName || null,
        customerEmail: input.customerEmail || null,
        customerPhone: input.customerPhone || null,
        notes: input.notes || null,
        source: "api",
        test,
      },
    });
    return NextResponse.json({ payment });
  } catch (err) {
    return jsonError(err);
  }
}
