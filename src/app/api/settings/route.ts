import { NextResponse } from "next/server";
import { z } from "zod";
import { getSetting, setSetting } from "@/lib/db";
import { registerWebhook, verifyToken } from "@/lib/ziina";
import { listOrganizations } from "@/lib/zoho";
import { stripeBalance, stripeConfigured } from "@/lib/stripe";
import { env } from "@/lib/env";
import { jsonError } from "@/lib/api";

const KEYS = ["zoho_deposit_account_id", "default_item_id"] as const;

export async function GET() {
  const settings: Record<string, string | null> = {};
  for (const k of KEYS) settings[k] = await getSetting(k);

  const [ziina, zoho, stripe] = await Promise.allSettled([
    verifyToken(),
    listOrganizations(),
    stripeConfigured() ? stripeBalance() : Promise.resolve(null),
  ]);
  const orgId = process.env.ZOHO_ORG_ID;
  return NextResponse.json({
    settings,
    webhookUrl: `${env.appUrl()}/api/webhooks/ziina`,
    webhookRegisteredAt: await getSetting("webhook_registered_at"),
    testMode: env.ziinaTestMode(),
    ziina:
      ziina.status === "fulfilled"
        ? ziina.value
        : { ok: false, error: String((ziina.reason as Error)?.message ?? ziina.reason) },
    zoho:
      zoho.status === "fulfilled"
        ? { ok: true, name: zoho.value.find((o) => o.organization_id === orgId)?.name ?? `org ${orgId}` }
        : { ok: false, error: String((zoho.reason as Error)?.message ?? zoho.reason) },
    stripe: !stripeConfigured()
      ? { ok: false, configured: false }
      : stripe.status === "fulfilled" && stripe.value
        ? {
            ok: true,
            configured: true,
            livemode: stripe.value.livemode,
            currency: stripe.value.available[0]?.currency?.toUpperCase() ?? null,
            lastSync: await getSetting("stripe_synced_until"),
          }
        : {
            ok: false,
            configured: true,
            error: stripe.status === "rejected" ? String((stripe.reason as Error)?.message ?? stripe.reason) : "—",
          },
  });
}

const Schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("save"),
    zoho_deposit_account_id: z.string().optional(),
    default_item_id: z.string().optional(),
  }),
  z.object({ action: z.literal("register_webhook") }),
]);

export async function POST(req: Request) {
  try {
    const input = Schema.parse(await req.json());
    if (input.action === "register_webhook") {
      await registerWebhook(`${env.appUrl()}/api/webhooks/ziina`, env.ziinaWebhookSecret());
      await setSetting("webhook_registered_at", new Date().toISOString());
      return NextResponse.json({ ok: true });
    }
    for (const k of KEYS) {
      const v = input[k];
      if (v !== undefined) await setSetting(k, v);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return jsonError(err);
  }
}
