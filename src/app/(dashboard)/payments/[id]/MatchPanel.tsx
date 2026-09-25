"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, Check, X, ShieldAlert } from "lucide-react";
import { Alert, Button, Card } from "@/components/ui";
import { api } from "@/components/fetcher";
import type { Candidate } from "@/lib/reconcile-match";
import { useI18n } from "@/lib/i18n";

export function MatchPanel({ paymentId, candidates }: { paymentId: string; candidates: Candidate[] }) {
  const router = useRouter();
  const { t } = useI18n();
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
    <Card className="space-y-4 border-amber-300 bg-amber-50/50 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-amber-950">{t.match_alert_title}</h2>
          <p className="mt-1 text-xs text-amber-800 leading-relaxed">{t.match_alert_desc}</p>
        </div>
      </div>

      {error && <Alert tone="error">{error}</Alert>}

      <ul className="space-y-2.5">
        {candidates.map((c) => {
          const key = c.paymentId ?? c.invoiceId!;
          return (
            <li
              key={key}
              className="flex flex-col gap-3 rounded-xl border border-amber-200/80 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between shadow-2xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 font-bold text-slate-900 text-sm">
                  <span>{c.kind === "payment" ? t.match_payment_rec : t.match_invoice_rec}</span>
                  {c.invoiceNumber && <span className="num font-semibold text-slate-700">#{c.invoiceNumber}</span>}
                  {c.customerName && <span className="text-slate-500 font-medium truncate">— {c.customerName}</span>}
                </div>
                <div className="mt-1 text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                  <span className="num font-semibold text-slate-700">
                    {c.amount.toLocaleString("en-US", { minimumFractionDigits: 2 })} AED
                  </span>
                  <span>·</span>
                  <span className="num">{c.date}</span>
                  <span>·</span>
                  <span className="text-slate-400">{c.reasons.join(" · ")}</span>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <span
                  className="num inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800"
                  title={t.match_score_label}
                >
                  {Math.min(100, c.score)}%
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  loading={busy === key}
                  onClick={() =>
                    run(
                      key,
                      `/api/payments/${paymentId}/link`,
                      c.paymentId ? { zohoPaymentId: c.paymentId } : { zohoInvoiceId: c.invoiceId },
                    )
                  }
                >
                  <Check className="h-3.5 w-3.5" />
                  <span>{t.link_this_record}</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={busy === `x${key}`}
                  onClick={() => run(`x${key}`, `/api/payments/${paymentId}/ignore-matches`, { zohoIds: [key] })}
                >
                  <X className="h-3.5 w-3.5" />
                  <span>{t.not_this_record}</span>
                </Button>
              </div>
            </li>
          );
        })}
      </ul>

      <div className="pt-2 border-t border-amber-200/60">
        <Button
          variant="secondary"
          size="sm"
          loading={busy === "all"}
          onClick={() => run("all", `/api/payments/${paymentId}/ignore-matches`, {})}
          className="w-full sm:w-auto"
        >
          <ShieldAlert className="h-3.5 w-3.5 text-slate-500" />
          <span>{t.none_of_these_btn}</span>
        </Button>
      </div>
    </Card>
  );
}
