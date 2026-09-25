import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reconcile } from "@/lib/reconcile";
import { jsonError } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await reconcile({ ids: [id] });
    return NextResponse.json({ payment: await prisma.payment.findUniqueOrThrow({ where: { id } }) });
  } catch (err) {
    return jsonError(err);
  }
}
