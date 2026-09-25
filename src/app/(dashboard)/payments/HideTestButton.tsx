"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/components/fetcher";

export function HideTestButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (!confirm(`سيتم إخفاء ${count} دفعة تجريبية من كل الأقسام والإجماليات. يمكنك إظهارها لاحقًا من قسم "المخفية". متابعة؟`)) return;
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
      إخفاء الدفعات التجريبية ({count})
    </Button>
  );
}
