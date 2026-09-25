import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { listAccounts } from "@/lib/ledger";
import { toFils } from "@/lib/money";
import { dubaiDayStart } from "@/lib/ledger-dates";
import { jsonError } from "@/lib/api";

export async function GET() {
  return NextResponse.json({ accounts: await listAccounts() });
}

const Create = z.object({
  action: z.literal("create"),
  name: z.string().trim().min(1).max(120),
  kind: z.enum(["gateway", "bank", "partner"]),
});

const Update = z.object({
  action: z.literal("update"),
  id: z.string(),
  name: z.string().trim().min(1).max(120).optional(),
  opening: z.coerce.number().optional(),
  openingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
});

export async function POST(req: Request) {
  try {
    const body = z.discriminatedUnion("action", [Create, Update]).parse(await req.json());
    if (body.action === "create") {
      const account = await prisma.ledgerAccount.create({ data: { name: body.name, kind: body.kind, sortOrder: 10 } });
      return NextResponse.json({ account });
    }
    const account = await prisma.ledgerAccount.update({
      where: { id: body.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.opening !== undefined ? { openingFils: toFils(body.opening) } : {}),
        ...(body.openingDate !== undefined ? { openingDate: body.openingDate ? dubaiDayStart(body.openingDate) : null } : {}),
      },
    });
    return NextResponse.json({ account });
  } catch (err) {
    return jsonError(err);
  }
}
