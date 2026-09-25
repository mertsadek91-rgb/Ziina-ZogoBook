import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PaymentDetailClient } from "./PaymentDetailClient";

export const dynamic = "force-dynamic";

export default async function PaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await prisma.payment.findUnique({
    where: { id },
    include: { logs: { orderBy: { createdAt: "desc" }, take: 50 } },
  });
  if (!p) notFound();

  const serializedPayment = {
    id: p.id,
    ziinaIntentId: p.ziinaIntentId,
    amountFils: p.amountFils,
    tipFils: p.tipFils,
    feeFils: p.feeFils,
    currency: p.currency,
    originalAmountFils: p.originalAmountFils,
    originalCurrency: p.originalCurrency,
    status: p.status,
    zohoStatus: p.zohoStatus,
    customerName: p.customerName,
    customerEmail: p.customerEmail,
    customerPhone: p.customerPhone,
    orderNumber: p.orderNumber,
    message: p.message,
    zohoContactId: p.zohoContactId,
    zohoItemId: p.zohoItemId,
    zohoItemName: p.zohoItemName,
    zohoInvoiceNumber: p.zohoInvoiceNumber,
    zohoPaymentId: p.zohoPaymentId,
    redirectUrl: p.redirectUrl,
    createdAt: p.createdAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    cardBrand: p.cardBrand,
    cardLast4: p.cardLast4,
    test: p.test,
    archived: p.archived,
    source: p.source,
    emailSent: p.emailSent,
    syncedAt: p.syncedAt?.toISOString() ?? null,
    zohoCheckedAt: p.zohoCheckedAt?.toISOString() ?? null,
    zohoCandidates: p.zohoCandidates,
    lastError: p.lastError,
    liveMode: process.env.ZIINA_TEST_MODE !== "true",
    partnerAccountId: p.partnerAccountId,
    logs: p.logs.map((l) => ({
      id: l.id,
      step: l.step,
      success: l.success,
      detail: l.detail,
      createdAt: l.createdAt.toISOString(),
    })),
  };

  return <PaymentDetailClient payment={serializedPayment} />;
}
