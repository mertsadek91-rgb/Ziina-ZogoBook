import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { normalizeOrderNumber } from "@/lib/order";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "desc" } } },
  });
  if (!payment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ payment });
}

const PatchSchema = z.object({
  customerName: z.string().max(200).nullable().optional(),
  customerEmail: z.string().email().nullable().optional().or(z.literal("")),
  customerPhone: z.string().max(40).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  orderNumber: z.string().max(40).nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const data = PatchSchema.parse(await req.json());
    const payment = await prisma.payment.update({
      where: { id },
      data: {
        ...data,
        customerEmail: data.customerEmail === "" ? null : data.customerEmail,
        ...(data.orderNumber !== undefined ? { orderNumber: normalizeOrderNumber(data.orderNumber) } : {}),
      },
    });
    return NextResponse.json({ payment });
  } catch (err) {
    return jsonError(err);
  }
}
