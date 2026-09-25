"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/components/fetcher";
import { useI18n } from "@/lib/i18n";

interface Summary {
  fetched: number;
  created: number;
  updated: number;
  refundsUpdated: number;
  checkoutPermissionMissing?: boolean;
}

/** Pull new Stripe payments now (also runs every 10 minutes with the scheduled task). */
export function StripeSyncButton() {
  const router = useRouter();
  const { lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");

  async function run() {
    setBusy(true);
    setText("");
    try {
      const { summary: s } = await api<{ summary: Summary }>("/api/stripe/sync", { method: "POST" });
      setText(
        lang === "ar"
          ? `Stripe: ${s.created} جديدة، ${s.updated} محدّثة${s.refundsUpdated ? `، ${s.refundsUpdated} استرداد` : ""}`
          : `Stripe: ${s.created} new, ${s.updated} updated${s.refundsUpdated ? `, ${s.refundsUpdated} refunds` : ""}`,
      );
      if (s.checkoutPermissionMissing) {
        setText((x) =>
          x +
          (lang === "ar"
            ? " — أضف صلاحية Checkout Sessions (Read) للمفتاح لقراءة أرقام الطلبات"
            : " — add Checkout Sessions (Read) to the key to read order numbers"),
        );
      }
      router.refresh();
    } catch (e) {
      setText(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {text && <span className="max-w-xs rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">{text}</span>}
      <Button variant="secondary" loading={busy} onClick={run}>
        <RefreshCw className={`h-4 w-4 text-indigo-500 ${busy ? "animate-spin" : ""}`} />
        <span>{lang === "ar" ? "مزامنة Stripe" : "Sync Stripe"}</span>
      </Button>
    </div>
  );
}

/** Small gateway label used in payment lists. */
export function GatewayBadge({ gateway }: { gateway: string }) {
  if (gateway !== "stripe") return null;
  return (
    <span className="inline-flex items-center rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 ring-1 ring-indigo-200">
      Stripe
    </span>
  );
}
