"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EyeOff } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/components/fetcher";
import { useI18n } from "@/lib/i18n";

export function HideTestButton({ count }: { count: number }) {
  const router = useRouter();
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);

  async function run() {
    const confirmMsg =
      lang === "ar"
        ? `سيتم إخفاء ${count} دفعة تجريبية من كافة الأقسام والإجماليات. يمكنك إظهارها لاحقاً من قسم "المخفية". متابعة؟`
        : `Hide ${count} test payments from all lists and totals? You can unhide them anytime from the "Hidden" tab.`;
    if (!confirm(confirmMsg)) return;

    setBusy(true);
    try {
      await api("/api/payments/archive-test", { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" loading={busy} onClick={run}>
      <EyeOff className="h-4 w-4 text-slate-500" />
      <span>
        {t.hide_test_btn} ({count})
      </span>
    </Button>
  );
}
