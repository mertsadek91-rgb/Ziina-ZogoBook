import type { Payment } from "@prisma/client";
import { prisma, getSetting } from "./db";
import { getPaymentIntent, intentToPaymentFields } from "./ziina";
import * as zoho from "./zoho";
import { matchContact } from "./contacts";
import { fromFils } from "./money";
import { reconcile } from "./reconcile";
import { env } from "./env";
import { normalizeOrderNumber, zohoNote } from "./order";

export class MatchReviewError extends Error {
  constructor(count: number) {
    super(`وُجدت ${count} مطابقة محتملة في Zoho لهذه الدفعة — راجعها أولًا (اربطها أو أكّد أنها ليست نفس الدفعة) لتجنب فاتورة مكررة`);
  }
}

export interface SyncOptions {
  itemId: string;
  itemName?: string;
  sendEmail?: boolean; // default false
  date?: string; // yyyy-mm-dd override, defaults to payment date
  customer?: { name?: string; email?: string; phone?: string };
  orderNumber?: string; // Ziina app order number, written into the invoice notes
}

export interface SyncResult {
  ok: boolean;
  payment: Payment;
  error?: string;
}

async function log(paymentId: string, step: string, success: boolean, detail?: unknown) {
  await prisma.syncLog.create({
    data: {
      paymentId,
      step,
      success,
      detail: detail === undefined ? null : typeof detail === "string" ? detail : JSON.stringify(detail).slice(0, 4000),
    },
  });
}

function toDate(d: Date): string {
  // Asia/Dubai calendar date
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(d);
}

/** Pull the latest state of a payment from Ziina and store it. */
export async function refreshFromZiina(payment: Payment): Promise<Payment> {
  if (payment.source === "csv") return payment;
  const pi = await getPaymentIntent(payment.ziinaIntentId);
  const { createdAtZiina, ...fields } = intentToPaymentFields(pi);
  void createdAtZiina;
  return prisma.payment.update({
    where: { id: payment.id },
    data: {
      ...fields,
      paidAt: pi.status === "completed" ? (payment.paidAt ?? new Date()) : payment.paidAt,
    },
  });
}

/**
 * Full Ziina → Zoho flow. Every step checks Zoho first (by reference_number = Ziina intent id),
 * so it is safe to re-run and it resumes where a previous attempt stopped.
 */
export async function syncToZoho(paymentId: string, opts: SyncOptions): Promise<SyncResult> {
  let p = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  let step = "start";

  // Refusals that must not mark the payment as a sync error.
  if (p.archived) return { ok: false, payment: p, error: "هذه الدفعة مخفية — أظهرها أولًا قبل إصدار فاتورة" };
  // A test payment is not a real sale: never invoice it once the system runs in live mode.
  if (p.test && !env.ziinaTestMode()) {
    return { ok: false, payment: p, error: "هذه دفعة تجريبية ولا يمكن إصدار فاتورة حقيقية لها في الوضع الفعلي" };
  }

  try {
    // Customer details / order number edited in the form are saved first.
    if (opts.customer || opts.orderNumber !== undefined) {
      p = await prisma.payment.update({
        where: { id: p.id },
        data: {
          customerName: opts.customer?.name?.trim() || p.customerName,
          customerEmail: opts.customer?.email?.trim() || p.customerEmail,
          customerPhone: opts.customer?.phone?.trim() || p.customerPhone,
          orderNumber: opts.orderNumber !== undefined ? normalizeOrderNumber(opts.orderNumber) : p.orderNumber,
        },
      });
    }

    // 1. Payment must really be completed in Ziina.
    step = "ziina_check";
    p = await refreshFromZiina(p);
    if (p.status !== "completed") throw new Error(`الدفعة غير مكتملة في Ziina (الحالة: ${p.status})`);

    const reference = p.ziinaIntentId;
    const amount = fromFils(p.amountFils + p.tipFils);
    const date = opts.date || toDate(p.paidAt ?? p.createdAt);

    // 2. Before creating anything, make sure this payment is not already recorded in Zoho
    //    (e.g. entered manually without the Ziina reference). Possible matches must be reviewed first.
    step = "match_check";
    if (!p.zohoInvoiceId && !p.zohoPaymentId) {
      await reconcile({ ids: [p.id] });
      p = await prisma.payment.findUniqueOrThrow({ where: { id: p.id } });
      if (p.zohoStatus === "paid") return { ok: true, payment: p }; // already fully recorded in Zoho
      if (p.zohoCandidateCount > 0) throw new MatchReviewError(p.zohoCandidateCount);
    }

    // 3. Contact
    step = "contact";
    if (!p.zohoContactId) {
      if (!p.customerName && !p.customerEmail) throw new Error("يجب إدخال اسم العميل أو بريده الإلكتروني");
      const customer = { name: p.customerName, email: p.customerEmail, phone: p.customerPhone };
      const searches = [
        p.customerEmail && { email: p.customerEmail },
        p.customerPhone && { phone: p.customerPhone },
        p.customerName && { contact_name: p.customerName },
      ].filter(Boolean) as Parameters<typeof zoho.searchContacts>[0][];
      let contact: zoho.ZohoContact | undefined;
      for (const q of searches) {
        contact = matchContact(await zoho.searchContacts(q), customer);
        if (contact) break;
      }
      if (contact) {
        await log(p.id, step, true, `عميل موجود: ${contact.contact_name} (${contact.contact_id})`);
      } else {
        contact = await zoho.createContact({
          name: p.customerName || p.customerEmail!,
          email: p.customerEmail,
          phone: p.customerPhone,
        });
        await log(p.id, step, true, `تم إنشاء عميل جديد: ${contact.contact_name} (${contact.contact_id})`);
      }
      p = await prisma.payment.update({
        where: { id: p.id },
        data: { zohoContactId: contact.contact_id, zohoStatus: "contact_ready", lastError: null },
      });
    }

    // 4. Invoice
    step = "invoice";
    if (!p.zohoInvoiceId) {
      const existing = await zoho.findInvoicesByReference(reference);
      let invoice = existing[0];
      if (invoice) {
        await log(p.id, step, true, `فاتورة موجودة مسبقًا: ${invoice.invoice_number}`);
      } else {
        invoice = await zoho.createInvoice({
          customerId: p.zohoContactId!,
          date,
          referenceNumber: reference,
          itemId: opts.itemId,
          rate: amount,
          description: p.message,
          notes: zohoNote(reference, p.orderNumber),
        });
        await zoho.markInvoiceSent(invoice.invoice_id);
        await log(p.id, step, true, `تم إنشاء الفاتورة: ${invoice.invoice_number}`);
      }
      p = await prisma.payment.update({
        where: { id: p.id },
        data: {
          zohoInvoiceId: invoice.invoice_id,
          zohoInvoiceNumber: invoice.invoice_number,
          zohoItemId: opts.itemId,
          zohoItemName: opts.itemName ?? p.zohoItemName,
          zohoStatus: "invoiced",
          lastError: null,
        },
      });
    }

    // 5. Customer payment applied to the invoice
    step = "payment";
    if (!p.zohoPaymentId) {
      const existing = await zoho.findPaymentsByReference(reference);
      let payment = existing[0];
      if (payment) {
        await log(p.id, step, true, `دفعة موجودة مسبقًا: ${payment.payment_id}`);
      } else {
        payment = await zoho.createCustomerPayment({
          customerId: p.zohoContactId!,
          invoiceId: p.zohoInvoiceId!,
          amount,
          bankCharges: fromFils(p.feeFils),
          date,
          referenceNumber: reference,
          accountId: await getSetting("zoho_deposit_account_id"),
          description: zohoNote(reference, p.orderNumber),
        });
        await log(p.id, step, true, `تم تسجيل الدفعة: ${payment.payment_id}`);
      }
      p = await prisma.payment.update({
        where: { id: p.id },
        data: { zohoPaymentId: payment.payment_id, zohoStatus: "paid", syncedAt: new Date(), lastError: null },
      });
    }

    // 6. Optional email (default: do not send)
    step = "email";
    if (opts.sendEmail && !p.emailSent) {
      if (!p.customerEmail) throw new Error("لا يوجد بريد إلكتروني للعميل لإرسال الفاتورة");
      await zoho.emailInvoice(p.zohoInvoiceId!, p.customerEmail);
      p = await prisma.payment.update({ where: { id: p.id }, data: { emailSent: true } });
      await log(p.id, step, true, `تم إرسال الفاتورة إلى ${p.customerEmail}`);
    }

    return { ok: true, payment: p };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof MatchReviewError) {
      // Not a failure: the payment moves to the "review" tab and nothing is created in Zoho.
      await log(p.id, step, false, message);
      return { ok: false, payment: p, error: message };
    }
    const body = err instanceof zoho.ZohoError ? err.body : undefined;
    await log(p.id, step, false, { message, body });
    // Keep "invoiced" if the invoice exists so the tab stays accurate; mark error otherwise.
    p = await prisma.payment.update({
      where: { id: p.id },
      data: { lastError: `[${step}] ${message}`, zohoStatus: step === "email" ? p.zohoStatus : "error" },
    });
    return { ok: false, payment: p, error: message };
  }
}

