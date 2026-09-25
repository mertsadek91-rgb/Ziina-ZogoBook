import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { validateEntry } from "@/lib/ledger-calc";
import { jsonError } from "@/lib/api";

// Bank statement lines, parsed and classified in the browser and reviewed by the user.
const Line = z.object({
  date: z.string(),
  kind: z.enum(["transfer", "expense", "bank_fee", "income", "skip"]),
  amountFils: z.number().int().positive(),
  fromAccountId: z.string().optional().nullable(),
  toAccountId: z.string().optional().nullable(),
  category: z.string().max(60).optional().nullable(),
  description: z.string().max(1000).optional().nullable(),
  reference: z.string().max(120).optional().nullable(),
  externalId: z.string().min(1).max(80),
});

const Schema = z.object({
  bankAccountId: z.string(),
  lines: z.array(Line).max(5000),
  closingBalanceFils: z.number().int().optional(),
  closingDate: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const { bankAccountId, lines, closingBalanceFils, closingDate } = Schema.parse(await req.json());
    let created = 0;
    let duplicates = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [i, l] of lines.entries()) {
      if (l.kind === "skip") {
        skipped++;
        continue;
      }
      const date = new Date(l.date);
      const data = {
        date,
        kind: l.kind,
        amountFils: l.amountFils,
        feeFils: 0,
        fromAccountId: l.kind === "income" ? null : l.fromAccountId || null,
        toAccountId: l.kind === "transfer" || l.kind === "income" ? l.toAccountId || null : null,
        category: l.kind === "expense" ? l.category || "other" : null,
        description: l.description || null,
        reference: l.reference || null,
        source: "bank_csv",
        externalId: l.externalId,
      };
      const bad = isNaN(date.getTime()) ? "date" : validateEntry(data);
      if (bad) {
        errors.push(`سطر ${i + 1}: ${bad}`);
        continue;
      }
      if (await prisma.ledgerEntry.findUnique({ where: { externalId: l.externalId } })) {
        duplicates++;
        continue;
      }
      await prisma.ledgerEntry.create({ data });
      created++;
    }

    // Remember the statement's closing balance to compare it with the computed balance.
    if (closingBalanceFils !== undefined && closingDate) {
      const acc = await prisma.ledgerAccount.findUnique({ where: { id: bankAccountId } });
      const d = new Date(closingDate);
      if (acc && !isNaN(d.getTime()) && (!acc.statementDate || d >= acc.statementDate)) {
        await prisma.ledgerAccount.update({
          where: { id: bankAccountId },
          data: { statementBalanceFils: closingBalanceFils, statementDate: d },
        });
      }
    }
    return NextResponse.json({ created, duplicates, skipped, errors: errors.slice(0, 50) });
  } catch (err) {
    return jsonError(err);
  }
}
