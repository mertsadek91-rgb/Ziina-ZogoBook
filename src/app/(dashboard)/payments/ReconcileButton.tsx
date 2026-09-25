"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { api } from "@/components/fetcher";

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
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  async function run() {
    setBusy(true);
    setText("");
    try {
      const { summary: s } = await api<{ summary: Summary }>("/api/reconcile", { body: { sinceDays: 90 } });
      setText(
        s.checked === 0
          ? "لا توجد دفعات مكتملة للتحقق منها"
          : `تم فحص ${s.checked}: مرتبطة ${s.linked} (جديد ${s.newlyLinked})، تطابق محتمل ${s.withCandidates}، غير موجودة في Zoho ${s.unmatched}${s.missing ? `، محذوفة من Zoho ${s.missing}` : ""}`,
      );
      router.refresh();
    } catch (e) {
      setText(`خطأ: ${e instanceof Error ? e.message : e}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {text && <span className="max-w-md text-xs text-gray-600">{text}</span>}
      <Button variant="secondary" loading={busy} onClick={run} title="مطابقة دفعات آخر 90 يومًا مع فواتير ودفعات Zoho">
        تحقق مع Zoho
      </Button>
    </div>
  );
}
