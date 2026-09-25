import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { toFils } from "@/lib/money";
import { normalizeOrderNumber } from "@/lib/order";
import { parseZiinaDate } from "@/lib/ziina-csv";
import { jsonError } from "@/lib/api";

// Rows are already mapped to our fields in the browser (Ziina export auto-mapping or manual column mapping).
const Row = z.object({
  ziinaIntentId: z.string().min(1),
  amount: z.union([z.string(), z.number()]),
  fee: z.union([z.string(), z.number()]).optional(),
  tip: z.union([z.string(), z.number()]).optional(),
  status: z.string().optional(),
  date: z.string().optional(),
  message: z.string().optional(),
  customerName: z.string().optional(),
  customerEmail: z.string().optional(),
  customerPhone: z.string().optional(),
  orderNumber: z.string().optional(),
  cardLast4: z.string().max(8).optional(),
});

const Schema = z.object({ rows: z.array(Row).min(1).max(5000) });

function normalizeStatus(s?: string): string {
  const v = (s ?? "").trim().toLowerCase();
  if (!v || ["completed", "paid", "success", "succeeded", "successful"].includes(v)) return "completed";
  if (["failed", "declined"].includes(v)) return "failed";
  if (["canceled", "cancelled", "refunded"].includes(v)) return "canceled";
  return "pending";
}

/** Accepts ISO dates and Ziina's DD/MM/YYYY (Dubai time). Never guesses MM/DD. */
function parseDate(s?: string): Date | null {
  if (!s) return null;
  const iso = parseZiinaDate(s) ?? s;
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d;
}

const optFils = (v?: string | number) => (v === undefined || v === "" ? 0 : Math.abs(toFils(v)));

export async function POST(req: Request) {
  try {
    const { rows } = Schema.parse(await req.json());
    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const [i, r] of rows.entries()) {
      try {
        const id = r.ziinaIntentId.trim();
        const orderNumber = normalizeOrderNumber(r.orderNumber);
        const exists = await prisma.payment.findUnique({ where: { ziinaIntentId: id } });
        if (exists) {
          // Fill in details the payment is missing (e.g. a webhook payment has no customer name); never overwrite.
          const fill = {
            ...(!exists.customerName && r.customerName ? { customerName: r.customerName } : {}),
            ...(!exists.customerEmail && r.customerEmail ? { customerEmail: r.customerEmail } : {}),
            ...(!exists.customerPhone && r.customerPhone ? { customerPhone: r.customerPhone } : {}),
            ...(!exists.orderNumber && orderNumber ? { orderNumber } : {}),
            ...(!exists.cardLast4 && r.cardLast4 ? { cardLast4: r.cardLast4 } : {}),
          };
          if (Object.keys(fill).length) {
            await prisma.payment.update({ where: { id: exists.id }, data: fill });
            updated++;
          } else skipped++;
          continue;
        }

        const date = parseDate(r.date);
        if (r.date && !date) throw new Error(`تاريخ غير صالح: ${r.date}`);
        const status = normalizeStatus(r.status);
        await prisma.payment.create({
          data: {
            ziinaIntentId: id,
            amountFils: toFils(r.amount),
            feeFils: optFils(r.fee),
            tipFils: optFils(r.tip),
            status,
            message: r.message || null,
            customerName: r.customerName || null,
            customerEmail: r.customerEmail || null,
            customerPhone: r.customerPhone || null,
            orderNumber,
            cardLast4: r.cardLast4 || null,
            createdAt: date ?? new Date(),
            paidAt: status === "completed" ? (date ?? new Date()) : null,
            source: "csv",
          },
        });
        created++;
      } catch (e) {
        errors.push(`سطر ${i + 1}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return NextResponse.json({ created, updated, skipped, errors: errors.slice(0, 50) });
  } catch (err) {
    return jsonError(err);
  }
}
