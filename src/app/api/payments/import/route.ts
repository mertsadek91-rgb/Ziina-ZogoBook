import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toFils } from "@/lib/money";
import { jsonError } from "@/lib/api";

// Rows are already mapped to our fields in the browser (column mapping UI).
const Row = z.object({
  ziinaIntentId: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  fee: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  message: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
});

const Schema = z.object({ rows: z.array(Row).min(1).max(5000) });

function normalizeStatus(s?: string): string {
  const v = (s ?? "").trim().toLowerCase();
  if (!v || ["completed", "paid", "success", "succeeded", "successful"].includes(v)) return "completed";
  if (["failed", "declined"].includes(v)) return "failed";
  if (["canceled", "cancelled", "refunded"].includes(v)) return "canceled";
  return "pending";
}

export async function POST(req: Request) {
  try {
    const { rows } = Schema.parse(await req.json());
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [i, r] of rows.entries()) {
      try {
        const exists = await prisma.payment.findUnique({ where: { ziinaIntentId: r.ziinaIntentId.trim() } });
        if (exists) {
          skipped++;
          continue;
        }
        const date = r.date ? new Date(r.date) : new Date();
        const status = normalizeStatus(r.status);
        await prisma.payment.create({
          data: {
            ziinaIntentId: r.ziinaIntentId.trim(),
            amountFils: toFils(r.amount),
            feeFils: r.fee !== undefined && r.fee !== "" ? Math.abs(toFils(r.fee)) : 0,
            status,
            message: r.message || null,
            customerName: r.customerName || null,
            customerEmail: r.customerEmail || null,
            customerPhone: r.customerPhone || null,
            createdAt: isNaN(date.getTime()) ? new Date() : date,
            paidAt: status === "completed" && !isNaN(date.getTime()) ? date : null,
            source: "csv",
          },
        });
        created++;
      } catch (e) {
        errors.push(`سطر ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return NextResponse.json({ created, skipped, errors: errors.slice(0, 50) });
  } catch (err) {
    return jsonError(err);
  }
}
