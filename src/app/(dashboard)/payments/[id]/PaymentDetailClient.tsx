"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  CreditCard,
  Building,
  History,
  ExternalLink,
  ShieldAlert,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Badge, Card, ziinaTone, zohoTone } from "@/components/ui";
import { formatMoney } from "@/lib/money";
import { useI18n } from "@/lib/i18n";
import { PaymentActions } from "./PaymentActions";
import { MatchPanel } from "./MatchPanel";
import type { Candidate } from "@/lib/reconcile-match";

interface LogItem {
  id: string;
  step: string;
  success: boolean;
  detail: string | null;
  createdAt: string;
}

interface PaymentData {
  id: string;
  ziinaIntentId: string;
  amountFils: number;
  tipFils: number;
  feeFils: number;
  currency: string;
  originalAmountFils: number | null;
  originalCurrency: string | null;
  status: string;
  zohoStatus: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  orderNumber: string | null;
  message: string | null;
  zohoContactId: string | null;
  zohoItemId: string | null;
  zohoItemName: string | null;
  zohoInvoiceNumber: string | null;
  zohoPaymentId: string | null;
  redirectUrl: string | null;
  createdAt: string;
  paidAt: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  test: boolean;
  archived: boolean;
  source: string;
  emailSent: boolean;
  syncedAt: string | null;
  zohoCheckedAt: string | null;
  zohoCandidates: string | null;
  lastError: string | null;
  logs: LogItem[];
  liveMode: boolean;
  partnerAccountId: string | null;
  gateway: string;
  amountRefundedFils: number;
  stripeInvoiceNumber: string | null;
  stripeInvoiceUrl: string | null;
  stripeInvoicePdf: string | null;
}

export function PaymentDetailClient({ payment }: { payment: PaymentData }) {
  const { t, lang, dir } = useI18n();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fmt = (d: string | null) =>
    d
      ? new Date(d).toLocaleString("en-GB", {
          timeZone: "Asia/Dubai",
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "—";

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1500);
  }

  const getZiinaStatusLabel = (status: string) => {
    const key = `ziina_${status}` as keyof typeof t;
    return (t[key] as string) || status;
  };

  const getZohoStatusLabel = (status: string) => {
    const key = `zoho_${status}` as keyof typeof t;
    return (t[key] as string) || status;
  };

  const isStripe = payment.gateway === "stripe";
  const sourceLabel = isStripe
    ? lang === "ar"
      ? "مزامنة من Stripe"
      : "Synced from Stripe"
    : payment.source === "csv"
      ? t.source_csv
      : payment.source === "webhook"
        ? t.source_webhook
        : t.source_app;

  const rows: [string, React.ReactNode, string?][] = [
    [t.amount, <span key="1" className="num font-bold text-slate-900">{formatMoney(payment.amountFils, payment.currency)}</span>],
    ...(payment.originalAmountFils != null && payment.originalCurrency
      ? ([[t.customer_paid, <span key="2" className="num text-slate-700">{formatMoney(payment.originalAmountFils, payment.originalCurrency)}</span>]] as [string, React.ReactNode, string?][])
      : []),
    [t.tip, <span key="3" className="num text-slate-700">{formatMoney(payment.tipFils, payment.currency)}</span>],
    [
      isStripe ? (lang === "ar" ? "رسوم Stripe" : "Stripe fees") : t.ziina_fees,
      <span key="4" className="num text-slate-700">{formatMoney(payment.feeFils, payment.currency)}</span>,
    ],
    ...(payment.amountRefundedFils > 0
      ? ([
          [
            lang === "ar" ? "المسترد" : "Refunded",
            <span key="4r" className="num font-semibold text-rose-600">
              −{formatMoney(payment.amountRefundedFils, payment.currency)}
            </span>,
          ],
        ] as [string, React.ReactNode, string?][])
      : []),
    [
      t.net_payout,
      <span key="5" className="num font-bold text-emerald-700">
        {formatMoney(payment.amountFils + payment.tipFils - payment.feeFils - payment.amountRefundedFils, payment.currency)}
      </span>,
    ],
    [t.order_number, payment.orderNumber ? <span key="6" className="num font-bold text-slate-800">#{payment.orderNumber}</span> : "—", payment.orderNumber ?? undefined],
    [t.col_desc, payment.message ?? "—"],
    [t.created_at, <span key="7" className="num text-slate-600">{fmt(payment.createdAt)}</span>],
    [t.paid_at, <span key="8" className="num text-slate-600">{fmt(payment.paidAt)}</span>],
    [
      t.card_label,
      payment.cardBrand ? <span key="9" className="num text-slate-700">{`${payment.cardBrand} •••• ${payment.cardLast4 ?? ""}`}</span> : "—",
    ],
    ...(isStripe && (payment.stripeInvoiceNumber || payment.stripeInvoiceUrl)
      ? ([
          [
            lang === "ar" ? "فاتورة Stripe" : "Stripe invoice",
            <span key="si" className="inline-flex items-center gap-2">
              <span className="num font-bold text-slate-800">{payment.stripeInvoiceNumber ?? "—"}</span>
              {payment.stripeInvoiceUrl && (
                <a href={payment.stripeInvoiceUrl} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                  {lang === "ar" ? "عرض" : "View"}
                </a>
              )}
              {payment.stripeInvoicePdf && (
                <a href={payment.stripeInvoicePdf} target="_blank" rel="noreferrer" className="text-indigo-600 hover:underline">
                  PDF
                </a>
              )}
            </span>,
          ],
        ] as [string, React.ReactNode, string?][])
      : []),
    [
      isStripe ? "Stripe ID" : t.ziina_id,
      <span key="10" className="num text-xs text-slate-500 font-mono select-all">
        {payment.ziinaIntentId}
      </span>,
      payment.ziinaIntentId,
    ],
    [t.source_label, sourceLabel],
  ];

  const zohoRows: [string, React.ReactNode, string?][] = [
    [t.zoho_contact_id, <span key="z1" className="num text-slate-700">{payment.zohoContactId ?? "—"}</span>, payment.zohoContactId ?? undefined],
    [t.zoho_service, payment.zohoItemName ?? payment.zohoItemId ?? "—"],
    [t.zoho_invoice_no, <span key="z2" className="num font-bold text-slate-800">{payment.zohoInvoiceNumber ?? "—"}</span>, payment.zohoInvoiceNumber ?? undefined],
    [t.zoho_payment_no, <span key="z3" className="num text-slate-700">{payment.zohoPaymentId ?? "—"}</span>, payment.zohoPaymentId ?? undefined],
    [t.email_sent, payment.emailSent ? t.yes : t.no],
    [t.last_sync, <span key="z4" className="num text-slate-600">{fmt(payment.syncedAt)}</span>],
    [t.last_zoho_check, <span key="z5" className="num text-slate-600">{fmt(payment.zohoCheckedAt)}</span>],
  ];

  const candidates: Candidate[] = payment.zohoCandidates ? JSON.parse(payment.zohoCandidates) : [];

  return (
    <div className="space-y-6">
      {/* Breadcrumb & Title Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/payments"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
          >
            {dir === "rtl" ? <ArrowRight className="h-3.5 w-3.5" /> : <ArrowLeft className="h-3.5 w-3.5" />}
            <span>{t.back_to_payments}</span>
          </Link>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">
            {payment.customerName || t.unnamed_payment}
          </h1>
          {payment.orderNumber && (
            <span className="num rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
              #{payment.orderNumber}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={ziinaTone(payment.status)} dot>
            {getZiinaStatusLabel(payment.status)}
          </Badge>
          <Badge tone={zohoTone(payment.zohoStatus)}>
            {getZohoStatusLabel(payment.zohoStatus)}
          </Badge>
          {payment.test && <Badge tone="yellow">{t.test_pill}</Badge>}
          {payment.archived && <Badge tone="gray">{t.tab_archived}</Badge>}
        </div>
      </div>

      {/* Main Grid: Left Column Details, Right Column Actions & Logs */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Left Column (2 Cols on lg) */}
        <div className="space-y-6 lg:col-span-2">
          {/* Ziina Details Card */}
          <Card>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700 font-bold">
                <CreditCard className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">{t.ziina_details_title}</h2>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              {rows.map(([label, val, copyVal], idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 py-1 border-b border-slate-50 last:border-0">
                  <dt className="text-slate-500 font-medium">{label}</dt>
                  <dd className="flex items-center gap-1.5 text-end font-medium">
                    {val}
                    {copyVal && (
                      <button
                        type="button"
                        onClick={() => copy(copyVal, `z_${idx}`)}
                        className="text-slate-400 hover:text-slate-700 p-0.5"
                        title={t.copy}
                      >
                        {copiedKey === `z_${idx}` ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            {payment.redirectUrl && payment.status !== "completed" && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="font-semibold text-slate-700 mb-1">{t.open_link}:</div>
                <div className="num break-all text-slate-500 font-mono select-all">{payment.redirectUrl}</div>
              </div>
            )}
          </Card>

          {/* Zoho Books Card */}
          <Card>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700 font-bold">
                <Building className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">{t.zoho_details_title}</h2>
            </div>

            <dl className="mt-4 space-y-2.5 text-xs">
              {zohoRows.map(([label, val, copyVal], idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 py-1 border-b border-slate-50 last:border-0">
                  <dt className="text-slate-500 font-medium">{label}</dt>
                  <dd className="flex items-center gap-1.5 text-end font-medium">
                    {val}
                    {copyVal && (
                      <button
                        type="button"
                        onClick={() => copy(copyVal, `zoho_${idx}`)}
                        className="text-slate-400 hover:text-slate-700 p-0.5"
                        title={t.copy}
                      >
                        {copiedKey === `zoho_${idx}` ? (
                          <Check className="h-3 w-3 text-emerald-600" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </button>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>

        {/* Right Column (3 Cols on lg) */}
        <div className="space-y-6 lg:col-span-3">
          {/* Potential Candidate Match Panel */}
          {candidates.length > 0 && payment.zohoStatus !== "paid" && !payment.archived && (
            <MatchPanel paymentId={payment.id} candidates={candidates} />
          )}

          {/* Payment Actions & Invoicing Form */}
          <PaymentActions
            payment={{
              id: payment.id,
              status: payment.status,
              zohoStatus: payment.zohoStatus,
              customerName: payment.customerName ?? "",
              customerEmail: payment.customerEmail ?? "",
              customerPhone: payment.customerPhone ?? "",
              zohoItemId: payment.zohoItemId ?? "",
              zohoItemName: payment.zohoItemName ?? "",
              emailSent: payment.emailSent,
              lastError: payment.lastError,
              paidDate: new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai" }).format(
                new Date(payment.paidAt ?? payment.createdAt),
              ),
              source: payment.source,
              test: payment.test,
              archived: payment.archived,
              liveMode: payment.liveMode,
              orderNumber: payment.orderNumber ?? "",
              partnerAccountId: payment.partnerAccountId ?? "",
              gateway: payment.gateway,
            }}
          />

          {/* Activity & Sync Audit Log */}
          <Card>
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-bold">
                <History className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">{t.activity_logs_title}</h2>
            </div>

            {payment.logs.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400 font-medium">{t.no_logs_yet}</div>
            ) : (
              <ul className="mt-4 space-y-3">
                {payment.logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3 text-xs"
                  >
                    <div className="mt-0.5 shrink-0">
                      {log.success ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <XCircle className="h-4 w-4 text-rose-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-800">{log.step}</span>
                        <span className="num text-[11px] text-slate-400">{fmt(log.createdAt)}</span>
                      </div>
                      <p className="mt-1 text-slate-600 leading-relaxed break-words">{log.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
