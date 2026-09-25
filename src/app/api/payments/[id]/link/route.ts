import { NextResponse } from "next/server";
import { z } from "zod";
import { linkCandidate } from "@/lib/reconcile";
import { jsonError } from "@/lib/api";

const Schema = z
  .object({ zohoPaymentId: z.string().optional(), zohoInvoiceId: z.string().optional() })
  .refine((v) => v.zohoPaymentId || v.zohoInvoiceId, "zohoPaymentId or zohoInvoiceId is required");

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    return NextResponse.json({ payment: await linkCandidate(id, Schema.parse(await req.json())) });
  } catch (err) {
    return jsonError(err);
  }
}
