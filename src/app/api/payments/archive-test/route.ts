import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/** Hide every test payment in one go. */
export async function POST() {
  const r = await prisma.payment.updateMany({ where: { test: true, archived: false }, data: { archived: true } });
  return NextResponse.json({ hidden: r.count });
}
