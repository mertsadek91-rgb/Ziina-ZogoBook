"use client";

import { useEffect, useState } from "react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { ItemPicker } from "@/components/ItemPicker";
import { api } from "@/components/fetcher";

interface SettingsResponse {
  settings: Record<string, string | null>;
  webhookUrl: string;
  webhookRegisteredAt: string | null;
  testMode: boolean;
  ziina: { ok: boolean; name?: string; error?: string };
  zoho: { ok: boolean; name?: string; error?: string };
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [accounts, setAccounts] = useState<{ account_id: string; account_name: string; account_type: string }[]>([]);
  const [depositAccount, setDepositAccount] = useState("");
  const [defaultItem, setDefaultItem] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  async function load() {
    const d = await api<SettingsResponse>("/api/settings");
    setData(d);
    setDepositAccount(d.settings.zoho_deposit_account_id ?? "");
    setDefaultItem(d.settings.default_item_id ?? "");
    if (d.zoho.ok) {
      api<{ accounts: typeof accounts }>("/api/zoho/accounts")
        .then((r) => setAccounts(r.accounts))
        .catch(() => {});
    }
  }

  useEffect(() => {
    load().catch((e) => setMsg({ tone: "error", text: String(e) }));
  }, []);

  async function act(name: string, body: unknown, ok: string) {
    setBusy(name);
    setMsg(null);
    try {
      await api("/api/settings", { body });
      setMsg({ tone: "success", text: ok });
      await load();
    } catch (e) {
      setMsg({ tone: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(null);
    }
  }

  if (!data) return <div className="text-gray-500">جارِ التحميل...</div>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <h1 className="text-xl font-bold">الإعدادات</h1>
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      <Card className="space-y-3">
        <h2 className="font-semibold">حالة الاتصال</h2>
        <div className="flex items-center justify-between">
          <span>Ziina {data.testMode && <Badge tone="yellow">وضع تجريبي</Badge>}</span>
          {data.ziina.ok ? <Badge tone="green">متصل — {data.ziina.name}</Badge> : <Badge tone="red">{data.ziina.error}</Badge>}
        </div>
        <div className="flex items-center justify-between">
          <span>Zoho Books</span>
          {data.zoho.ok ? <Badge tone="green">متصل — {data.zoho.name}</Badge> : <Badge tone="red">{data.zoho.error}</Badge>}
        </div>
      </Card>

      <Card className="space-y-3">
        <h2 className="font-semibold">Webhook من Ziina</h2>
        <p className="text-sm text-gray-500">
          يسمح لـ Ziina بإبلاغ النظام فورًا عند اكتمال أي دفعة. يجب أن يكون التطبيق على رابط عام (APP_URL). لكل حساب Ziina
          webhook واحد فقط، والتسجيل يستبدل السابق.
        </p>
        <div className="num break-all rounded-lg bg-gray-50 p-2 text-left text-sm">{data.webhookUrl}</div>
        <div className="flex items-center gap-3">
          <Button loading={busy === "wh"} disabled={!data.ziina.ok} onClick={() => {
              if (!confirm("سيتم استبدال أي Webhook مسجل حاليًا في حساب Ziina (مثل إضافة Shopify أو WooCommerce). متابعة؟")) return;
              act("wh", { action: "register_webhook" }, "تم تسجيل الـ Webhook");
            }}>
            تسجيل الـ Webhook في Ziina
          </Button>
          {data.webhookRegisteredAt && (
            <span className="num text-xs text-gray-500">آخر تسجيل: {new Date(data.webhookRegisteredAt).toLocaleString("en-GB")}</span>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-semibold">إعدادات Zoho Books</h2>
        <div>
          <label>الحساب الذي تُودَع فيه دفعات Ziina</label>
          <select value={depositAccount} onChange={(e) => setDepositAccount(e.target.value)}>
            <option value="">— الافتراضي في Zoho —</option>
            {accounts.map((a) => (
              <option key={a.account_id} value={a.account_id}>
                {a.account_name} ({a.account_type})
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">يُنصح بإنشاء حساب بنكي/مقاصة باسم &quot;Ziina&quot; في Zoho لتسهيل المطابقة.</p>
        </div>
        <div>
          <label>الخدمة الافتراضية (اختياري)</label>
          {data.zoho.ok && <ItemPicker value={defaultItem} onChange={(id) => setDefaultItem(id)} />}
        </div>
        <Button
          loading={busy === "save"}
          onClick={() =>
            act("save", { action: "save", zoho_deposit_account_id: depositAccount, default_item_id: defaultItem }, "تم الحفظ")
          }
        >
          حفظ
        </Button>
      </Card>
    </div>
  );
}
