// Pure matching logic between a local Ziina payment and Zoho invoices / customer payments.
// No I/O here, so it is fully unit-tested.

export interface ZInvoice {
  invoice_id: string;
  invoice_number: string;
  reference_number?: string;
  date: string; // yyyy-mm-dd
  total: number;
  balance: number;
  status?: string;
  customer_id: string;
  customer_name?: string;
  email?: string;
}

export interface ZPayment {
  payment_id: string;
  payment_number?: string;
  reference_number?: string;
  date: string;
  amount: number;
  customer_id: string;
  customer_name?: string;
  invoice_numbers?: string;
  payment_mode?: string;
  account_name?: string;
  description?: string;
}

export interface LocalPayment {
  ziinaIntentId: string;
  grossFils: number;
  feeFils: number;
  date: string; // yyyy-mm-dd (Dubai)
  customerName?: string | null;
  customerEmail?: string | null;
  zohoInvoiceId?: string | null;
  zohoPaymentId?: string | null;
}

export interface Candidate {
  kind: "payment" | "invoice";
  paymentId?: string;
  paymentNumber?: string;
  invoiceId?: string;
  invoiceNumber?: string;
  amount: number;
  date: string;
  customerName?: string;
  score: number;
  reasons: string[];
}

export type MatchResult =
  | { kind: "linked"; invoice?: ZInvoice; payment?: ZPayment; via: "reference" | "ids" }
  | { kind: "missing"; lostInvoice: boolean; lostPayment: boolean } // was linked, no longer in Zoho
  | { kind: "candidates"; candidates: Candidate[] }
  | { kind: "none" };

export interface Index {
  invoices: ZInvoice[];
  payments: ZPayment[];
  invoiceById: Map<string, ZInvoice>;
  paymentById: Map<string, ZPayment>;
  invoiceByNumber: Map<string, ZInvoice>;
  invoiceByRef: Map<string, ZInvoice>;
  paymentByRef: Map<string, ZPayment>;
}

export function buildIndex(invoices: ZInvoice[], payments: ZPayment[]): Index {
  const byRef = <T extends { reference_number?: string }>(rows: T[]) => {
    const m = new Map<string, T>();
    for (const r of rows) if (r.reference_number) m.set(r.reference_number.trim(), r);
    return m;
  };
  return {
    invoices,
    payments,
    invoiceById: new Map(invoices.map((i) => [i.invoice_id, i])),
    paymentById: new Map(payments.map((p) => [p.payment_id, p])),
    invoiceByNumber: new Map(invoices.map((i) => [i.invoice_number, i])),
    invoiceByRef: byRef(invoices),
    paymentByRef: byRef(payments),
  };
}

const fils = (aed: number) => Math.round(aed * 100);

export function dayDiff(a: string, b: string): number {
  return Math.abs(Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86400_000;
}

const norm = (s?: string | null) => (s ?? "").trim().toLowerCase().replace(/\s+/g, " ");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invoicesOfPayment(p: ZPayment, idx: Index): ZInvoice[] {
  return (p.invoice_numbers ?? "")
    .split(",")
    .map((n) => idx.invoiceByNumber.get(n.trim()))
    .filter((i): i is ZInvoice => !!i);
}

function paymentOfInvoice(inv: ZInvoice, idx: Index): ZPayment | undefined {
  return idx.payments.find((p) =>
    (p.invoice_numbers ?? "").split(",").some((n) => n.trim() === inv.invoice_number),
  );
}

export interface MatchOptions {
  windowDays?: number; // date tolerance for candidates (default 3)
  usedIds?: Set<string>; // Zoho ids already linked to other local payments
  ignoredIds?: Set<string>; // Zoho ids the user rejected for this payment
}

export function matchPayment(local: LocalPayment, idx: Index, opts: MatchOptions = {}): MatchResult {
  const ref = local.ziinaIntentId;

  // 1. Exact: the Ziina intent id was written into reference_number (by this app or manually).
  const refPayment = idx.paymentByRef.get(ref);
  const refInvoice = idx.invoiceByRef.get(ref);
  if (refPayment || refInvoice) {
    const invoice = refInvoice ?? (refPayment ? invoicesOfPayment(refPayment, idx)[0] : undefined);
    const payment = refPayment ?? (invoice ? paymentOfInvoice(invoice, idx) : undefined);
    return { kind: "linked", invoice, payment, via: "reference" };
  }

  // 2. Previously linked by id (e.g. a manual match confirmed by the user).
  if (local.zohoInvoiceId || local.zohoPaymentId) {
    const invoice = local.zohoInvoiceId ? idx.invoiceById.get(local.zohoInvoiceId) : undefined;
    const payment = local.zohoPaymentId ? idx.paymentById.get(local.zohoPaymentId) : undefined;
    const lostInvoice = !!local.zohoInvoiceId && !invoice;
    const lostPayment = !!local.zohoPaymentId && !payment;
    if (lostInvoice || lostPayment) return { kind: "missing", lostInvoice, lostPayment };
    return { kind: "linked", invoice, payment: payment ?? (invoice ? paymentOfInvoice(invoice, idx) : undefined), via: "ids" };
  }

  // 3. Heuristic candidates: same amount (gross or net of Ziina fee), close date, customer hints.
  const window = opts.windowDays ?? 3;
  const gross = local.grossFils;
  const net = local.grossFils - local.feeFils;
  const skip = (id: string, reference?: string) =>
    opts.usedIds?.has(id) ||
    opts.ignoredIds?.has(id) ||
    // belongs to a different Ziina payment
    (!!reference && UUID.test(reference.trim()) && reference.trim() !== ref);

  const email = norm(local.customerEmail);
  const name = norm(local.customerName);

  function score(amountFils: number, date: string, custName?: string, custEmail?: string) {
    const reasons: string[] = [];
    let s = 0;
    if (amountFils === gross) {
      s += 50;
      reasons.push("نفس المبلغ");
    } else if (net !== gross && amountFils === net) {
      s += 45;
      reasons.push("نفس المبلغ بعد خصم رسوم Ziina");
    } else return null;
    const d = dayDiff(date, local.date);
    if (d > window) return null;
    s += d === 0 ? 30 : d === 1 ? 20 : 10;
    reasons.push(d === 0 ? "نفس اليوم" : `فرق ${d} يوم`);
    if (email && norm(custEmail) === email) {
      s += 30;
      reasons.push("نفس الإيميل");
    }
    const cn = norm(custName);
    if (name && cn && (cn === name || cn.includes(name) || name.includes(cn))) {
      s += 20;
      reasons.push("اسم العميل متطابق");
    }
    return { s, reasons };
  }

  const candidates: Candidate[] = [];
  const coveredInvoices = new Set<string>();

  for (const p of idx.payments) {
    if (skip(p.payment_id, p.reference_number)) continue;
    const invs = invoicesOfPayment(p, idx);
    const inv = invs[0];
    const r = score(fils(p.amount), p.date, p.customer_name, inv?.email);
    if (!r) continue;
    invs.forEach((i) => coveredInvoices.add(i.invoice_id));
    candidates.push({
      kind: "payment",
      paymentId: p.payment_id,
      paymentNumber: p.payment_number,
      invoiceId: inv?.invoice_id,
      invoiceNumber: p.invoice_numbers || inv?.invoice_number,
      amount: p.amount,
      date: p.date,
      customerName: p.customer_name,
      score: r.s,
      reasons: r.reasons,
    });
  }

  for (const i of idx.invoices) {
    if (coveredInvoices.has(i.invoice_id) || skip(i.invoice_id, i.reference_number)) continue;
    if (i.status === "void" || i.status === "draft") continue;
    const r = score(fils(i.total), i.date, i.customer_name, i.email);
    if (!r) continue;
    candidates.push({
      kind: "invoice",
      invoiceId: i.invoice_id,
      invoiceNumber: i.invoice_number,
      amount: i.total,
      date: i.date,
      customerName: i.customer_name,
      score: r.s - 5, // an invoice alone is weaker evidence than a recorded payment
      reasons: [...r.reasons, i.balance > 0 ? "فاتورة غير مدفوعة" : "فاتورة مدفوعة"],
    });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.length ? { kind: "candidates", candidates: candidates.slice(0, 5) } : { kind: "none" };
}
