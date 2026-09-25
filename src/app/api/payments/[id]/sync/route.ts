import { NextResponse } from "next/server";
import { z } from "zod";
import { syncToZoho } from "@/lib/sync";
import { jsonError } from "@/lib/api";

const SyncSchema = z.object({
  itemId: z.string().min(1, "اختر الخدمة"),
  itemName: z.string().optional(),
  sendEmail: z.boolean().default(false),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal("")),
  customer: z
    .object({
      name: z.string().max(200).optional(),
      email: z.string().email().optional().or(z.literal("")),
      phone: z.string().max(40).optional(),
    })
    .optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const input = SyncSchema.parse(await req.json());
    const result = await syncToZoho(id, { ...input, date: input.date || undefined });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return jsonError(err);
  }
}
