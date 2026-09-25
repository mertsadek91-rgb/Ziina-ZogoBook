import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toFils } from "@/lib/money";
import { validateEntry } from "@/lib/ledger-calc";
import { dubaiMidday } from "@/lib/ledger-dates";
import { jsonError } from "@/lib/api";

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

/**
 * Edit an entry. Lines imported from a bank statement keep the bank's date, amount and reference
 * (they are facts from the statement, and the reference is what prevents re-importing them);
 * their type, accounts, category and description can be changed.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const i = Schema.parse(await req.json());
    const existing = await prisma.ledgerEntry.findUniqueOrThrow({ where: { id } });
    const fromBank = existing.source === "bank_csv";

    const data = {
      date: fromBank ? existing.date : dubaiMidday(i.date),
      kind: i.kind,
      amountFils: fromBank ? existing.amountFils : toFils(i.amount),
      feeFils: i.kind === "transfer" && i.fee ? toFils(i.fee) : 0,
      fromAccountId: i.kind === "income" ? null : i.fromAccountId || null,
      toAccountId: i.kind === "transfer" || i.kind === "income" ? i.toAccountId || null : null,
      category: i.kind === "expense" ? i.category || "other" : null,
      description: i.description || null,
      reference: fromBank ? existing.reference : i.reference || null,
    };
    const bad = validateEntry(data);
    if (bad) throw new Error(ERR[bad] ?? bad);
    const entry = await prisma.ledgerEntry.update({ where: { id }, data });
    return NextResponse.json({ entry });
  } catch (err) {
    return jsonError(err);
  }
}

/** Remove a ledger entry booked by mistake. An imported statement line can be re-imported afterwards. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    await prisma.ledgerEntry.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
