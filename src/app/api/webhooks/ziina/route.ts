import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { intentToPaymentFields, verifyHmac, ZIINA_WEBHOOK_IPS, type ZiinaPaymentIntent } from "@/lib/ziina";

export async function POST(req: Request) {
  const raw = await req.text();

  const secret = env.ziinaWebhookSecret();
  if (secret && !verifyHmac(raw, req.headers.get("x-hmac-signature"), secret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  // Without a secret, fall back to Ziina's documented source IPs.
  if (!secret) {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
    if (!ZIINA_WEBHOOK_IPS.includes(ip)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: { event?: string; data?: ZiinaPaymentIntent };
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  if (payload.event !== "payment_intent.status.updated" || !payload.data?.id) {
    return NextResponse.json({ ok: true, ignored: payload.event });
  }

  const pi = payload.data;
  const { createdAtZiina, ...fields } = intentToPaymentFields(pi);
  const existing = await prisma.payment.findUnique({ where: { ziinaIntentId: pi.id } });

  if (existing) {
    await prisma.payment.update({
      where: { id: existing.id },
      data: { ...fields, paidAt: pi.status === "completed" ? (existing.paidAt ?? new Date()) : existing.paidAt },
    });
  } else {
    // Unknown intent (e.g. a link created in the Ziina app): record it so customer details can be filled in.
    await prisma.payment.create({
      data: {
        ziinaIntentId: pi.id,
        ...fields,
        createdAt: createdAtZiina ?? undefined,
        paidAt: pi.status === "completed" ? new Date() : null,
        source: "webhook",
      },
    });
  }
  return NextResponse.json({ ok: true });
}
