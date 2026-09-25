import { NextResponse } from "next/server";
import { z } from "zod";
import { ignoreCandidates } from "@/lib/reconcile";
import { jsonError } from "@/lib/api";

const Schema = z.object({ zohoIds: z.array(z.string()).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { zohoIds } = Schema.parse(await req.json().catch(() => ({})));
    return NextResponse.json({ payment: await ignoreCandidates(id, zohoIds) });
  } catch (err) {
    return jsonError(err);
  }
}
