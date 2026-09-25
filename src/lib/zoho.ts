import { env } from "./env";

// ---------- OAuth ----------

let cachedToken: { token: string; expiresAt: number } | null = null;
let inflight: Promise<string> | null = null;

function accountsUrl() {
  return `https://accounts.zoho.${env.zohoDc()}`;
}
function apiBase() {
  return `https://www.zohoapis.${env.zohoDc()}/books/v3`;
}

async function refreshAccessToken(): Promise<string> {
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: env.zohoClientId(),
    client_secret: env.zohoClientSecret(),
    refresh_token: env.zohoRefreshToken(),
  });
  const res = await fetch(`${accountsUrl()}/oauth/v2/token?${params}`, { method: "POST", cache: "no-store" });
  const data = (await res.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !data.access_token) {
    throw new ZohoError(`Zoho OAuth refresh failed: ${data.error ?? res.status}`, res.status, data);
  }
  cachedToken = { token: data.access_token, expiresAt: Date.now() + ((data.expires_in ?? 3600) - 120) * 1000 };
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.token;
  if (!inflight) inflight = refreshAccessToken().finally(() => (inflight = null));
  return inflight;
}

// ---------- HTTP ----------

export class ZohoError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
  }
}

interface ZohoResponse {
  code: number;
  message: string;
  [k: string]: unknown;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request<T extends ZohoResponse>(
  method: string,
  path: string,
  opts: { query?: Record<string, string | number | boolean | undefined>; body?: unknown } = {},
  attempt = 0,
): Promise<T> {
  const url = new URL(`${apiBase()}${path}`);
  url.searchParams.set("organization_id", env.zohoOrgId());
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
  }

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${await getAccessToken()}`,
      "Content-Type": "application/json",
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    cache: "no-store",
  });

  // Rate limit (100 req/min/org) → back off and retry.
  if (res.status === 429 && attempt < 4) {
    await sleep(2000 * 2 ** attempt);
    return request<T>(method, path, opts, attempt + 1);
  }
  // Expired / revoked token → refresh once.
  if (res.status === 401 && attempt === 0) {
    cachedToken = null;
    return request<T>(method, path, opts, attempt + 1);
  }

  const data = (await res.json().catch(() => ({ code: -1, message: `HTTP ${res.status}` }))) as T;
  if (!res.ok || data.code !== 0) {
    throw new ZohoError(`Zoho: ${data.message ?? res.status}`, res.status, data);
  }
  return data;
}

// ---------- Types ----------

export interface ZohoItem {
  item_id: string;
  name: string;
  rate: number;
  description?: string;
  product_type?: string;
  status?: string;
  sku?: string;
}

export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  email?: string;
  phone?: string;
  mobile?: string;
}

export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  status: string;
  total: number;
  balance: number;
  reference_number?: string;
  customer_id: string;
}

export interface ZohoCustomerPayment {
  payment_id: string;
  payment_number?: string;
  amount: number;
  reference_number?: string;
  date: string;
}

export interface ZohoAccount {
  account_id: string;
  account_name: string;
  account_type: string;
}

// ---------- API ----------

export async function listOrganizations() {
  // /organizations does not need organization_id but tolerates it.
  const res = await request<ZohoResponse & { organizations: { organization_id: string; name: string }[] }>(
    "GET",
    "/organizations",
  );
  return res.organizations;
}

export async function listItems(): Promise<ZohoItem[]> {
  const items: ZohoItem[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await request<ZohoResponse & { items: ZohoItem[]; page_context?: { has_more_page?: boolean } }>(
      "GET",
      "/items",
      { query: { filter_by: "Status.Active", page, per_page: 200 } },
    );
    items.push(...res.items);
    if (!res.page_context?.has_more_page) break;
  }
  return items;
}

/** Bank / cash / clearing accounts that can receive a customer payment. */
export async function listDepositAccounts(): Promise<ZohoAccount[]> {
  const res = await request<ZohoResponse & { chartofaccounts: ZohoAccount[] }>("GET", "/chartofaccounts", {
    query: { filter_by: "AccountType.Active" },
  });
  return res.chartofaccounts.filter((a) =>
    ["bank", "cash", "other_current_asset", "payment_clearing"].includes(a.account_type),
  );
}

export async function searchContacts(query: {
  email?: string;
  phone?: string;
  contact_name?: string;
}): Promise<ZohoContact[]> {
  const res = await request<ZohoResponse & { contacts: ZohoContact[] }>("GET", "/contacts", {
    query: { ...query, contact_type: "customer", per_page: 50 },
  });
  return res.contacts;
}

export async function createContact(input: { name: string; email?: string | null; phone?: string | null }) {
  const [first, ...rest] = input.name.trim().split(/\s+/);
  const res = await request<ZohoResponse & { contact: ZohoContact }>("POST", "/contacts", {
    body: {
      contact_name: input.name.trim(),
      contact_type: "customer",
      contact_persons: [
        {
          first_name: first,
          last_name: rest.join(" ") || undefined,
          email: input.email || undefined,
          phone: input.phone || undefined,
          is_primary_contact: true,
        },
      ],
    },
  });
  return res.contact;
}

export async function findInvoicesByReference(reference: string): Promise<ZohoInvoice[]> {
  const res = await request<ZohoResponse & { invoices: ZohoInvoice[] }>("GET", "/invoices", {
    query: { reference_number: reference },
  });
  // Zoho may do partial matching; keep exact matches only.
  return res.invoices.filter((i) => i.reference_number === reference);
}

export async function getInvoice(invoiceId: string): Promise<ZohoInvoice> {
  const res = await request<ZohoResponse & { invoice: ZohoInvoice }>("GET", `/invoices/${invoiceId}`);
  return res.invoice;
}

export async function createInvoice(input: {
  customerId: string;
  date: string; // yyyy-mm-dd
  referenceNumber: string;
  itemId: string;
  rate: number;
  description?: string | null;
  notes?: string;
}): Promise<ZohoInvoice> {
  const res = await request<ZohoResponse & { invoice: ZohoInvoice }>("POST", "/invoices", {
    query: { send: false },
    body: {
      customer_id: input.customerId,
      date: input.date,
      due_date: input.date,
      reference_number: input.referenceNumber,
      is_inclusive_tax: false,
      line_items: [
        {
          item_id: input.itemId,
          rate: input.rate,
          quantity: 1,
          description: input.description || undefined,
          tax_id: "", // No VAT
        },
      ],
      notes: input.notes,
    },
  });
  return res.invoice;
}

export async function markInvoiceSent(invoiceId: string): Promise<void> {
  await request("POST", `/invoices/${invoiceId}/status/sent`);
}

export async function emailInvoice(invoiceId: string, toEmail: string): Promise<void> {
  await request("POST", `/invoices/${invoiceId}/email`, { body: { to_mail_ids: [toEmail] } });
}

export async function findPaymentsByReference(reference: string): Promise<ZohoCustomerPayment[]> {
  const res = await request<ZohoResponse & { customerpayments: ZohoCustomerPayment[] }>("GET", "/customerpayments", {
    query: { reference_number: reference },
  });
  return res.customerpayments.filter((p) => p.reference_number === reference);
}

export function isNotFound(e: unknown): boolean {
  return e instanceof ZohoError && (e.status === 404 || /does not exist|not found|invalid.*id/i.test(e.message));
}

async function listAllInRange<T>(path: string, key: string, from: string, to: string): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await request<ZohoResponse & { page_context?: { has_more_page?: boolean } }>("GET", path, {
      query: { date_start: from, date_end: to, page, per_page: 200 },
    });
    rows.push(...((res[key] as T[]) ?? []));
    if (!res.page_context?.has_more_page) break;
  }
  return rows;
}

/** All invoices dated between from and to (yyyy-mm-dd), paginated. */
export function listInvoicesInRange(from: string, to: string) {
  return listAllInRange<import("./reconcile-match").ZInvoice>("/invoices", "invoices", from, to);
}

/** All customer payments dated between from and to (yyyy-mm-dd), paginated. */
export function listPaymentsInRange(from: string, to: string) {
  return listAllInRange<import("./reconcile-match").ZPayment>("/customerpayments", "customerpayments", from, to);
}

export interface ZohoPaymentDetail {
  payment_id: string;
  payment_number?: string;
  customer_id: string;
  customer_name?: string;
  amount: number;
  date: string;
  reference_number?: string;
  invoices?: { invoice_id: string; invoice_number: string; amount_applied: number }[];
}

export async function getCustomerPayment(paymentId: string): Promise<ZohoPaymentDetail> {
  const res = await request<ZohoResponse & { payment: ZohoPaymentDetail }>("GET", `/customerpayments/${paymentId}`);
  return res.payment;
}

export async function createCustomerPayment(input: {
  customerId: string;
  invoiceId: string;
  amount: number;
  bankCharges: number;
  date: string;
  referenceNumber: string;
  accountId?: string | null;
  description?: string;
}): Promise<ZohoCustomerPayment> {
  const res = await request<ZohoResponse & { payment: ZohoCustomerPayment }>("POST", "/customerpayments", {
    body: {
      customer_id: input.customerId,
      payment_mode: "creditcard",
      amount: input.amount,
      bank_charges: input.bankCharges || undefined,
      date: input.date,
      reference_number: input.referenceNumber,
      description: input.description,
      account_id: input.accountId || undefined,
      invoices: [{ invoice_id: input.invoiceId, amount_applied: input.amount }],
    },
  });
  return res.payment;
}
