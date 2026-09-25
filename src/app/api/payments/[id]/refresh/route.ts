import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { refreshFromZiina } from "@/lib/sync";
import { jsonError } from "@/lib/api";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const p = await prisma.payment.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ payment: await refreshFromZiina(p) });
  } catch (err) {
    return jsonError(err);
  }
}
