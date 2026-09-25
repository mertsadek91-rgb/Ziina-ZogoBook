"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { ItemPicker } from "@/components/ItemPicker";
import { api } from "@/components/fetcher";

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
}

export function PaymentActions({ payment }: { payment: P }) {
  const router = useRouter();
  const [customer, setCustomer] = useState({
    name: payment.customerName,
    email: payment.customerEmail,
    phone: payment.customerPhone,
  });
  const [item, setItem] = useState({ id: payment.zohoItemId, name: payment.zohoItemName });
  const [date, setDate] = useState(payment.paidDate);
  const [sendEmail, setSendEmail] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(
    payment.lastError ? { tone: "error", text: payment.lastError } : null,
  );

  const completed = payment.status === "completed";
  const done = payment.zohoStatus === "paid";

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
        body: { itemId: item.id, itemName: item.name, sendEmail, date, customer },
      });
      if (!r.ok) throw new Error(r.error);
      return "تم إصدار الفاتورة وتسجيل الدفعة في Zoho Books بنجاح";
    });

  const sendEmailOnly = () =>
    run("email", async () => {
      const r = await api<{ ok: boolean; error?: string }>(`/api/payments/${payment.id}/sync`, {
        body: { itemId: item.id || "-", sendEmail: true, customer },
      });
      if (!r.ok) throw new Error(r.error);
      return "تم إرسال الفاتورة بالإيميل";
    });

  const saveCustomer = () =>
    run("save", async () => {
      await api(`/api/payments/${payment.id}`, {
        method: "PATCH",
        body: { customerName: customer.name, customerEmail: customer.email, customerPhone: customer.phone },
      });
      return "تم حفظ بيانات العميل";
    });

  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">{done ? "الفاتورة مكتملة" : "إصدار فاتورة في Zoho Books"}</h2>
        <div className="flex gap-2">
          {payment.source !== "csv" && (
            <Button
              variant="secondary"
              loading={busy === "refresh"}
              onClick={() =>
                run("refresh", async () => {
                  await api(`/api/payments/${payment.id}/refresh`, { method: "POST" });
                  return "تم تحديث الحالة من Ziina";
                })
              }
            >
              تحديث من Ziina
            </Button>
          )}
          <Button
            variant="secondary"
            loading={busy === "recheck"}
            onClick={() =>
              run("recheck", async () => {
                await api(`/api/payments/${payment.id}/recheck`, { method: "POST" });
                return "تمت إعادة الفحص مع Zoho";
              })
            }
          >
            إعادة فحص مع Zoho
          </Button>
        </div>
      </div>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {!completed && <Alert tone="info">لا يمكن إصدار الفاتورة قبل اكتمال الدفع في Ziina.</Alert>}

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <div>
          <label>اسم العميل *</label>
          <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />
        </div>
        <div>
          <label>الإيميل</label>
          <input
            type="email"
            dir="ltr"
            value={customer.email}
            onChange={(e) => setCustomer({ ...customer, email: e.target.value })}
          />
        </div>
        <div>
          <label>الهاتف</label>
          <input dir="ltr" value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} />
        </div>
      </fieldset>
      {!done && (
        <Button variant="ghost" loading={busy === "save"} onClick={saveCustomer}>
          حفظ بيانات العميل فقط
        </Button>
      )}

      {completed && !done && (
        <>
          <div>
            <label>الخدمة (من Zoho Books) *</label>
            <ItemPicker value={item.id} onChange={(id, name) => setItem({ id, name })} />
            {item.name && <div className="mt-1 text-sm text-gray-600">المختار: {item.name}</div>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label>تاريخ الفاتورة والدفعة</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2">
              <input type="checkbox" className="w-auto" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} />
              إرسال الفاتورة بالإيميل للعميل
            </label>
          </div>
          <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
            سيتم: البحث عن العميل في Zoho (إيميل ← هاتف ← اسم) أو إنشاؤه، ثم إنشاء فاتورة بمرجع رقم دفعة Ziina، ثم تسجيل
            الدفعة عليها مع رسوم Ziina كرسوم بنكية. العملية آمنة للتكرار ولن تُنشئ فواتير مكررة.
          </div>
          <Button loading={busy === "sync"} disabled={!item.id || (!customer.name && !customer.email)} onClick={sync}>
            إصدار الفاتورة وتسجيل الدفعة
          </Button>
        </>
      )}

      {done && !payment.emailSent && (
        <Button variant="secondary" loading={busy === "email"} disabled={!customer.email} onClick={sendEmailOnly}>
          إرسال الفاتورة بالإيميل الآن
        </Button>
      )}
    </Card>
  );
}
