"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, Button, Card } from "@/components/ui";
import { api } from "@/components/fetcher";
import type { Candidate } from "@/lib/reconcile-match";

export function MatchPanel({ paymentId, candidates }: { paymentId: string; candidates: Candidate[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function run(key: string, url: string, body: unknown) {
    setBusy(key);
    setError("");
    try {
      await api(url, { body });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="space-y-4 border-amber-300 bg-amber-50/40">
      <div>
        <h2 className="font-semibold">⚠ يوجد سجل مشابه في Zoho — هل هذه الدفعة مسجلة مسبقًا؟</h2>
        <p className="mt-1 text-sm text-gray-600">
          لم نجد رقم دفعة Ziina في Zoho، لكن وجدنا سجلات بنفس المبلغ وتاريخ قريب. اربط الصحيح منها لمنع فاتورة مكررة، أو أكّد
          أنها ليست نفس الدفعة لتتمكن من إصدار فاتورة جديدة.
        </p>
      </div>
      {error && <Alert tone="error">{error}</Alert>}
      <ul className="space-y-2">
        {candidates.map((c) => {
          const key = c.paymentId ?? c.invoiceId!;
          return (
            <li key={key} className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="font-medium">
                  {c.kind === "payment" ? "دفعة مسجلة" : "فاتورة"}
                  {c.invoiceNumber && <span className="num ms-2">{c.invoiceNumber}</span>}
                  {c.customerName && <span className="ms-2 text-gray-600">— {c.customerName}</span>}
                </div>
                <div className="mt-0.5 text-xs text-gray-500">
                  <span className="num">
                    {c.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED · {c.date}
                  </span>
                  {" · "}
                  {c.reasons.join("، ")}
                </div>
              </div>
              <span className="num rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600" title="درجة التطابق">
                {Math.min(100, c.score)}%
              </span>
              <Button
                loading={busy === key}
                onClick={() =>
                  run(key, `/api/payments/${paymentId}/link`, c.paymentId ? { zohoPaymentId: c.paymentId } : { zohoInvoiceId: c.invoiceId })
                }
              >
                ربط بهذا السجل
              </Button>
              <Button
                variant="ghost"
                loading={busy === `x${key}`}
                onClick={() => run(`x${key}`, `/api/payments/${paymentId}/ignore-matches`, { zohoIds: [key] })}
              >
                ليس هو
              </Button>
            </li>
          );
        })}
      </ul>
      <Button
        variant="secondary"
        loading={busy === "all"}
        onClick={() => run("all", `/api/payments/${paymentId}/ignore-matches`, {})}
      >
        لا شيء منها — هذه دفعة جديدة
      </Button>
    </Card>
  );
}
