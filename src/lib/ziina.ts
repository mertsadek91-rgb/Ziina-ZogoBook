import crypto from "node:crypto";
import { env } from "./env";

const BASE_URL = "https://api-v2.ziina.com/api";

/** IPs Ziina documents as webhook sources. */
export const ZIINA_WEBHOOK_IPS = ["3.29.184.186", "3.29.190.95", "20.233.47.127", "13.202.161.181"];

export type ZiinaStatus =
  | "requires_payment_instrument"
  | "requires_user_action"
  | "pending"
  | "completed"
  | "failed"
  | "canceled";

export const FINAL_STATUSES: ZiinaStatus[] = ["completed", "failed", "canceled"];

export interface ZiinaPaymentIntent {
  id: string;
  account_id?: string;
  amount: number;
  tip_amount?: number;
  vat_amount?: number;
  fee_amount?: number;
  currency_code: string;
  created_at: string | number;
  status: ZiinaStatus;
  operation_id?: string;
  message?: string;
  redirect_url?: string;
  embedded_url?: string;
  success_url?: string;
  cancel_url?: string;
  settled?: { amount?: number; tip_amount?: number; vat_amount?: number; currency_code?: string };
  latest_error?: { message?: string; code?: string } | null;
  allow_tips?: boolean;
  card_details?: { brand?: string; last4?: string; last_four?: string } | null;
}

export class ZiinaError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.ziinaToken()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  if (!res.ok) {
    const apiMsg = data && typeof data === "object" && "message" in data ? String(data.message) : "";
    const msg = apiMsg || `Ziina ${method} ${path} failed with ${res.status}`;
    throw new ZiinaError(msg, res.status, data);
  }
  return data as T;
}

export interface CreateIntentInput {
  amountFils: number; // base units of `currency`
  currency?: string; // ISO-4217, defaults to ZIINA_CURRENCY (AED)
  message?: string;
  expiryMs?: number; // absolute unix time in ms
  allowTips?: boolean;
  test?: boolean;
}

export function createPaymentIntent(input: CreateIntentInput): Promise<ZiinaPaymentIntent> {
  const app = env.appUrl();
  return request<ZiinaPaymentIntent>("POST", "/payment_intent", {
    amount: input.amountFils,
    currency_code: input.currency ?? env.ziinaCurrency(),
    message: input.message || undefined,
    success_url: `${app}/pay/result?status=success&pi={PAYMENT_INTENT_ID}`,
    cancel_url: `${app}/pay/result?status=cancel&pi={PAYMENT_INTENT_ID}`,
    failure_url: `${app}/pay/result?status=failure&pi={PAYMENT_INTENT_ID}`,
    test: input.test ?? env.ziinaTestMode(),
    expiry: input.expiryMs ? String(input.expiryMs) : undefined,
    allow_tips: input.allowTips ?? false,
  });
}

export function getPaymentIntent(id: string): Promise<ZiinaPaymentIntent> {
  return request<ZiinaPaymentIntent>("GET", `/payment_intent/${encodeURIComponent(id)}`);
}

export function getAccount(): Promise<{ account_id: string; display_name?: string; ziiname?: string; status?: string }> {
  return request("GET", "/account");
}

/**
 * Checks the token without needing account scope: tokens created for payments only get 401 on
 * /account, so we read a non-existent intent instead — "not found" means the token is accepted.
 */
export async function verifyToken(): Promise<{ ok: boolean; name?: string; error?: string }> {
  try {
    await getPaymentIntent("00000000-0000-0000-0000-000000000000");
  } catch (e) {
    if (!(e instanceof ZiinaError) || e.status === 401 || e.status === 403) {
      return { ok: false, error: e instanceof Error ? e.message : String(e) };
    }
    // 400 PAYMENT_INTENT_NOT_FOUND / 404 → token is valid.
  }
  const account = await getAccount().catch(() => null);
  return { ok: true, name: account?.display_name ?? account?.ziiname ?? "صلاحية المدفوعات فعّالة" };
}

export function registerWebhook(url: string, secret?: string): Promise<unknown> {
  return request("POST", "/webhook", { url, secret: secret || undefined });
}

export function deleteWebhook(): Promise<unknown> {
  return request("DELETE", "/webhook");
}

/** Ziina sends a hex HMAC-SHA256 of the raw body in the X-Hmac-Signature header. */
export function verifyHmac(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(signature.trim().toLowerCase(), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Map a Ziina intent to the local Payment columns.
 * For foreign-card payments `amount`/`currency_code` are in the customer's currency (e.g. SAR/USD),
 * while `settled` holds what the merchant receives in AED — that is what gets invoiced.
 * `fee_amount` is already in the settlement currency.
 */
export function intentToPaymentFields(pi: ZiinaPaymentIntent) {
  const createdAt =
    typeof pi.created_at === "number" || /^\d+$/.test(String(pi.created_at))
      ? new Date(Number(pi.created_at))
      : new Date(pi.created_at);
  const settledAmount = pi.settled?.amount;
  const settledCurrency = pi.settled?.currency_code;
  const useSettled = settledAmount != null && !!settledCurrency;
  const foreign = useSettled && settledCurrency !== pi.currency_code;
  return {
    amountFils: useSettled ? settledAmount : pi.amount,
    currency: useSettled ? settledCurrency : pi.currency_code,
    originalAmountFils: foreign ? pi.amount : null,
    originalCurrency: foreign ? pi.currency_code : null,
    message: pi.message ?? null,
    status: pi.status,
    redirectUrl: pi.redirect_url ?? null,
    operationId: pi.operation_id ?? null,
    feeFils: pi.fee_amount ?? 0,
    tipFils: (useSettled ? pi.settled?.tip_amount : pi.tip_amount) ?? 0,
    settledFils: pi.settled?.amount ?? null,
    cardBrand: pi.card_details?.brand ?? null,
    cardLast4: pi.card_details?.last4 ?? pi.card_details?.last_four ?? null,
    lastErrorZiina: pi.latest_error?.message ?? null,
    createdAtZiina: isNaN(createdAt.getTime()) ? null : createdAt,
  };
}
