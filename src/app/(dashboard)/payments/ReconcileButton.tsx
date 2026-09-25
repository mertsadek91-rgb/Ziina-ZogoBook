"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/components/fetcher";
import { useI18n } from "@/lib/i18n";

interface Summary {
  checked: number;
  linked: number;
  newlyLinked: number;
  withCandidates: number;
  missing: number;
  unmatched: number;
}

export function ReconcileButton() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  async function run() {
    setBusy(true);
    setText("");
    try {
      const { summary: s } = await api<{ summary: Summary }>("/api/reconcile", { body: { sinceDays: 90 } });
      if (s.checked === 0) {
        setText(lang === "ar" ? "لا توجد دفعات مكتملة للتحقق منها" : "No completed payments found to reconcile");
      } else {
        const msg =
          lang === "ar"
            ? `تم فحص ${s.checked}: مرتبطة ${s.linked} (جديد ${s.newlyLinked})، تطابق محتمل ${s.withCandidates}، غير موجودة في Zoho ${s.unmatched}${s.missing ? `، محذوفة من Zoho ${s.missing}` : ""}`
            : `Checked ${s.checked}: linked ${s.linked} (new ${s.newlyLinked}), candidates ${s.withCandidates}, unmatched ${s.unmatched}${s.missing ? `, missing in Zoho ${s.missing}` : ""}`;
        setText(msg);
      }
      router.refresh();
    } catch (e) {
      setText(`${t.error}: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {text && (
        <span className="max-w-md rounded-lg bg-slate-100 px-2.5 py-1 text-xs text-slate-700 font-medium">
          {text}
        </span>
      )}
      <Button
        variant="secondary"
        loading={busy}
        onClick={run}
        title={lang === "ar" ? "مطابقة دفعات آخر 90 يوماً مع فواتير ودفعات Zoho" : "Reconcile last 90 days with Zoho Books"}
      >
        <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} />
        <span>{t.reconcile_btn}</span>
      </Button>
    </div>
  );
}
