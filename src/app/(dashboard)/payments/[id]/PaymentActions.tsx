"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  Save,
  Send,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  CheckCircle2,
  Mail,
  Calendar,
  User,
  Phone,
  Hash,
} from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { ItemPicker } from "@/components/ItemPicker";
import { PartnerSelect } from "@/components/ledger";
import { useAcc } from "@/lib/i18n-acc";
import { api } from "@/components/fetcher";
import { useI18n } from "@/lib/i18n";

interface P {
  id: string;
  status: string;
  zohoStatus: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  zohoItemId: string;
  zohoItemName: string;
  emailSent: boolean;
  lastError: string | null;
  paidDate: string;
  source: string;
  test: boolean;
  archived: boolean;
  liveMode: boolean;
  orderNumber: string;
  partnerAccountId: string;
  gateway?: string;
}

export function PaymentActions({ payment }: { payment: P }) {
  const router = useRouter();
  const { t, lang } = useI18n();

  const [customer, setCustomer] = useState({
    name: payment.customerName,
    email: payment.customerEmail,
    phone: payment.customerPhone,
  });
  const [orderNumber, setOrderNumber] = useState(payment.orderNumber);
  const { a } = useAcc();
  const [partnerId, setPartnerId] = useState(payment.partnerAccountId);
  const [partnerSaved, setPartnerSaved] = useState(false);

  // The partner only affects accounting, so it can be changed at any time (even after invoicing).
  async function changePartner(id: string) {
    const prev = partnerId;
    setPartnerId(id);
    setPartnerSaved(false);
    try {
      await api(`/api/payments/${payment.id}`, { method: "PATCH", body: { partnerAccountId: id || null } });
      setPartnerSaved(true);
      setTimeout(() => setPartnerSaved(false), 1500);
    } catch (e) {
      setPartnerId(prev);
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    }
  }
  const [item, setItem] = useState({ id: payment.zohoItemId, name: payment.zohoItemName });
  const [date, setDate] = useState(payment.paidDate);
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(
    payment.lastError ? { tone: "error", text: payment.lastError } : null,
  );

  const completed = payment.status === "completed";
  const done = payment.zohoStatus === "paid";
  const blocked = payment.archived || (payment.test && payment.liveMode);

  async function run(name: string, fn: () => Promise<string>) {
    setBusy(name);
    setMsg(null);
    try {
      setMsg({ tone: "success", text: await fn() });
      router.refresh();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  const sync = () =>
    run("sync", async () => {
      const r = await api<{ ok: boolean; error?: string }>(`/api/payments/${payment.id}/sync`, {
        body: { itemId: item.id, itemName: item.name, sendEmail, date, customer, orderNumber },
      });
      if (!r.ok) throw new Error(r.error);
      return lang === "ar"
        ? "تم إصدار الفاتورة وتسجيل الدفعة في Zoho Books بنجاح"
        : "Invoice created & payment recorded in Zoho Books successfully";
    });

  const sendEmailOnly = () =>
    run("email", async () => {
      const r = await api<{ ok: boolean; error?: string }>(`/api/payments/${payment.id}/sync`, {
        body: { itemId: item.id || "-", sendEmail: true, customer },
      });
      if (!r.ok) throw new Error(r.error);
      return lang === "ar" ? "تم إرسال الفاتورة بالإيميل بنجاح" : "Invoice emailed successfully";
    });

  const saveCustomer = () =>
    run("save", async () => {
      await api(`/api/payments/${payment.id}`, {
        method: "PATCH",
        body: { customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone, orderNumber },
      });
      return t.saved;
    });

  return (
    <Card className="space-y-5">
      {/* Action Bar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <h2 className="text-base font-bold text-slate-900">
          {done ? t.invoice_complete_title : t.invoice_action_title}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            loading={busy === "archive"}
            onClick={() =>
              run("archive", async () => {
                await api(`/api/payments/${payment.id}/archive`, { body: { archived: !payment.archived } });
                return payment.archived
                  ? lang === "ar" ? "تم إظهار الدفعة" : "Payment unhidden"
                  : lang === "ar" ? "تم إخفاء الدفعة" : "Payment hidden";
              })
            }
          >
            {payment.archived ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>{payment.archived ? t.unhide_payment_btn : t.hide_payment_btn}</span>
          </Button>

          {payment.source !== "csv" && payment.source !== "stripe" && (
            <Button
              variant="secondary"
              size="sm"
              loading={busy === "refresh"}
              onClick={() =>
                run("refresh", async () => {
                  await api(`/api/payments/${payment.id}/refresh`, { method: "POST" });
                  return lang === "ar" ? "تم تحديث الحالة من Ziina" : "Status refreshed from Ziina";
                })
              }
            >
              <RefreshCw className={`h-3.5 w-3.5 ${busy === "refresh" ? "animate-spin" : ""}`} />
              <span>{t.refresh_ziina_btn}</span>
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            loading={busy === "recheck"}
            onClick={() =>
              run("recheck", async () => {
                await api(`/api/payments/${payment.id}/recheck`, { method: "POST" });
                return lang === "ar" ? "تمت إعادة الفحص مع Zoho" : "Rechecked with Zoho";
              })
            }
          >
            <Search className="h-3.5 w-3.5" />
            <span>{t.recheck_zoho_btn}</span>
          </Button>
        </div>
      </div>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {payment.archived && <Alert tone="info">{t.payment_hidden_notice}</Alert>}
      {!payment.archived && payment.test && payment.liveMode && (
        <Alert tone="warning">{t.payment_test_blocked_notice}</Alert>
      )}
      {!completed && <Alert tone="info">{t.payment_incomplete_notice}</Alert>}

      {/* Partner entitled to this payment (accounting) */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-brand/20 bg-brand-50/40 p-3">
        <span className="text-xs font-bold text-slate-700">{a.partner}</span>
        <div className="w-56">
          <PartnerSelect value={partnerId} onChange={changePartner} compact />
        </div>
        {partnerSaved && <span className="text-xs font-semibold text-emerald-600">✓ {a.saved}</span>}
      </div>

      {/* Customer Information Fields */}
      <div className="space-y-3">
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider">
          {lang === "ar" ? "بيانات العميل والفاتورة" : "Customer & Invoice Info"}
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label>{payment.gateway === "stripe" ? (lang === "ar" ? "رقم الطلب في Stripe" : "Stripe order number") : t.order_number_ziina}</label>
            <div className="relative">
              <Hash className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
              <input
                dir="ltr"
                placeholder="#333136"
                value={orderNumber}
                disabled={done}
                onChange={(e) => setOrderNumber(e.target.value)}
                className="ps-9"
              />
            </div>
          </div>
          <div>
            <label>{t.customer_name_label}</label>
            <div className="relative">
              <User className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
              <input
                value={customer.name}
                onChange={(e) => setCustomer({ ...customer, name: e.target.value })}
                className="ps-9"
              />
            </div>
          </div>
          <div>
            <label>{t.customer_email_label}</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
              <input
                type="email"
                dir="ltr"
                value={customer.email}
                onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
                className="ps-9"
              />
            </div>
          </div>
          <div>
            <label>{t.customer_phone_label}</label>
            <div className="relative">
              <Phone className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-3.5 w-3.5 text-slate-400" />
              <input
                dir="ltr"
                value={customer.phone}
                onChange={(e) => setCustomer({ ...customer, phone: e.target.value })}
                className="ps-9"
              />
            </div>
          </div>
        </div>

        {!done && (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" loading={busy === "save"} onClick={saveCustomer}>
              <Save className="h-3.5 w-3.5" />
              <span>{t.save_customer_only}</span>
            </Button>
          </div>
        )}
      </div>

      {/* Zoho Invoicing Section */}
      {completed && !done && !blocked && (
        <div className="space-y-4 pt-3 border-t border-slate-100">
          <div>
            <label>{t.service_req}</label>
            <ItemPicker value={item.id} onChange={(id, name) => setItem({ id, name })} />
            {item.name && (
              <div className="mt-1.5 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">{t.service_selected}</span> {item.name}
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label>{t.invoice_date_label}</label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-4 w-4 text-slate-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="ps-9"
                />
              </div>
            </div>
            <label className="flex items-center gap-2.5 self-end pb-3 text-xs font-semibold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/20"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              <span>{t.send_email_customer_cb}</span>
            </label>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600 border border-slate-200/60">
            {t.invoice_explainer}
          </div>

          <Button
            size="lg"
            variant="primary"
            loading={busy === "sync"}
            disabled={!item.id || (!customer.name && !customer.email)}
            onClick={sync}
            className="w-full sm:w-auto"
          >
            <Send className="h-4 w-4" />
            <span>{t.issue_invoice_btn}</span>
          </Button>
        </div>
      )}

      {done && !payment.emailSent && (
        <div className="pt-2">
          <Button
            variant="secondary"
            size="md"
            loading={busy === "email"}
            disabled={!customer.email}
            onClick={sendEmailOnly}
          >
            <Mail className="h-4 w-4" />
            <span>{t.send_email_now_btn}</span>
          </Button>
        </div>
      )}
    </Card>
  );
}
