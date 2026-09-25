"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

function PayResultContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const status = searchParams.get("status");

  const view =
    status === "success"
      ? {
          icon: <CheckCircle2 className="h-12 w-12 text-emerald-600" />,
          title: t.pay_success_title,
          text: t.pay_success_desc,
          badgeCls: "bg-emerald-50 border-emerald-200 text-emerald-800",
        }
      : status === "cancel"
        ? {
            icon: <XCircle className="h-12 w-12 text-slate-500" />,
            title: t.pay_canceled_title,
            text: t.pay_canceled_desc,
            badgeCls: "bg-slate-50 border-slate-200 text-slate-700",
          }
        : {
            icon: <AlertCircle className="h-12 w-12 text-rose-600" />,
            title: t.pay_failed_title,
            text: t.pay_failed_desc,
            badgeCls: "bg-rose-50 border-rose-200 text-rose-800",
          };

  return (
    <div className="relative w-full max-w-sm space-y-4">
      <div className="flex justify-end">
        <LanguageSwitcher />
      </div>

      <div className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-8 text-center shadow-lg">
        <div className="flex justify-center">{view.icon}</div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{view.title}</h1>
        <p className="text-xs text-slate-500 leading-relaxed">{view.text}</p>
      </div>
    </div>
  );
}

export default function PayResult() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-slate-50/80">
      <Suspense>
        <PayResultContent />
      </Suspense>
    </div>
  );
}
