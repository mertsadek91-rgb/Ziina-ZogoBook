"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card } from "@/components/ui";
import { LinkResult } from "@/components/LinkResult";
import { api } from "@/components/fetcher";
import { decimalsOf, formatMoney } from "@/lib/money";
import { CurrencyHint, CurrencySelect } from "@/components/CurrencySelect";

interface Created {
  id: string;
  redirectUrl: string;
  amountFils: number;
  currency: string;
  message: string | null;
}

export default function NewLinkPage() {
  const [currency, setCurrency] = useState("AED");
  const [allowTips, setAllowTips] = useState(false);
  const [form, setForm] = useState({
    amount: "",
    message: "",
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    notes: "",
    expiryHours: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<Created | null>(null);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const r = await api<{ payment: Created }>("/api/payments", {
        body: { ...form, currency, allowTips, expiryHours: form.expiryHours || undefined },
      });
      setCreated(r.payment);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-xl font-bold">إنشاء رابط دفع</h1>
      <p className="text-sm text-gray-500">
        بيانات العميل تُحفظ مع الرابط لأن Ziina لا يُرجع اسم أو إيميل الدافع، وتُستخدم لاحقًا لإنشاء العميل والفاتورة في Zoho.
      </p>

      {created ? (
        <div className="space-y-4">
          <LinkResult
            url={created.redirectUrl}
            amountLabel={formatMoney(created.amountFils, created.currency)}
            message={created.message ?? undefined}
          />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setCreated(null);
                setForm({ amount: "", message: "", customerName: "", customerEmail: "", customerPhone: "", notes: "", expiryHours: "" });
              }}
            >
              رابط جديد
            </Button>
            <Link href={`/payments/${created.id}`}>
              <Button variant="ghost">عرض الدفعة</Button>
            </Link>
          </div>
        </div>
      ) : (
        <Card>
          <form onSubmit={submit} className="space-y-4">
            {error && <Alert tone="error">{error}</Alert>}
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label>المبلغ *</label>
                <input
                  type="number"
                  step={decimalsOf(currency) === 3 ? "0.001" : "0.01"}
                  min={currency === "AED" ? "2" : "0.01"}
                  required
                  dir="ltr"
                  value={form.amount}
                  onChange={set("amount")}
                />
              </div>
              <div>
                <label>العملة</label>
                <CurrencySelect value={currency} onChange={setCurrency} />
              </div>
              <div>
                <label>صلاحية الرابط (ساعات، اختياري)</label>
                <input type="number" min="1" dir="ltr" value={form.expiryHours} onChange={set("expiryHours")} />
              </div>
            </div>
            <CurrencyHint currency={currency} />
            <label className="flex items-center gap-2">
              <input type="checkbox" className="w-auto" checked={allowTips} onChange={(e) => setAllowTips(e.target.checked)} />
              السماح بالإكرامية (يمكن للعميل إضافة إكرامية عند الدفع)
            </label>
            <div>
              <label>الوصف (يظهر للعميل)</label>
              <input value={form.message} onChange={set("message")} placeholder="مثال: اشتراك شهري - خدمة التوصيات" />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label>اسم العميل</label>
                <input value={form.customerName} onChange={set("customerName")} />
              </div>
              <div>
                <label>الإيميل</label>
                <input type="email" dir="ltr" value={form.customerEmail} onChange={set("customerEmail")} />
              </div>
              <div>
                <label>الهاتف</label>
                <input dir="ltr" value={form.customerPhone} onChange={set("customerPhone")} />
              </div>
            </div>
            <div>
              <label>ملاحظات داخلية</label>
              <textarea rows={2} value={form.notes} onChange={set("notes")} />
            </div>
            <Button type="submit" loading={busy} className="w-full">
              إنشاء الرابط
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
