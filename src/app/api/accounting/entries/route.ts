import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toFils } from "@/lib/money";
import { validateEntry } from "@/lib/ledger-calc";
import { dubaiDayEnd, dubaiDayStart, dubaiMidday } from "@/lib/ledger-dates";
import { jsonError } from "@/lib/api";

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const from = dubaiDayStart(sp.get("from"));
  const to = dubaiDayEnd(sp.get("to"));
  const kind = sp.get("kind");
  const accountId = sp.get("account");
  const entries = await prisma.ledgerEntry.findMany({
    where: {
      ...(from || to ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      ...(kind ? { kind } : {}),
      ...(accountId ? { OR: [{ fromAccountId: accountId }, { toAccountId: accountId }] } : {}),
    },
    include: { fromAccount: { select: { name: true } }, toAccount: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 1000,
  });
  return NextResponse.json({ entries });
}

const ERR: Record<string, string> = {
  amount: "المبلغ يجب أن يكون أكبر من صفر",
  accounts: "اختر الحساب المناسب لنوع العملية",
  same_account: "لا يمكن التحويل من الحساب إلى نفسه",
  kind: "نوع العملية غير صالح",
};

const Schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  kind: z.enum(["transfer", "expense", "bank_fee", "income"]),
  amount: z.coerce.number().positive(),
  fee: z.coerce.number().min(0).optional(),
  fromAccountId: z.string().optional().nullable(),
  toAccountId: z.string().optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
});

export async function POST(req: Request) {
  try {
    const i = Schema.parse(await req.json());
    const data = {
      date: dubaiMidday(i.date),
      kind: i.kind,
      amountFils: toFils(i.amount),
      feeFils: i.kind === "transfer" && i.fee ? toFils(i.fee) : 0,
      // Keep only the accounts that make sense for the kind.
      fromAccountId: i.kind === "income" ? null : i.fromAccountId || null,
      toAccountId: i.kind === "transfer" || i.kind === "income" ? i.toAccountId || null : null,
      category: i.kind === "expense" ? i.category || "other" : null,
      description: i.description || null,
      reference: i.reference || null,
      source: "manual",
    };
    const bad = validateEntry(data);
    if (bad) throw new Error(ERR[bad] ?? bad);
    const entry = await prisma.ledgerEntry.create({ data });
    return NextResponse.json({ entry });
  } catch (err) {
    return jsonError(err);
  }
}
