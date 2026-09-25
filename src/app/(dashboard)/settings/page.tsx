"use client";

import { useEffect, useState } from "react";
import {
  Settings,
  Radio,
  Webhook,
  Building,
  Check,
  Copy,
  Save,
  ShieldAlert,
  HelpCircle,
  ExternalLink,
} from "lucide-react";
import { Alert, Badge, Button, Card } from "@/components/ui";
import { ItemPicker } from "@/components/ItemPicker";
import { api } from "@/components/fetcher";
import { useI18n } from "@/lib/i18n";

interface SettingsResponse {
  settings: Record<string, string | null>;
  webhookUrl: string;
  webhookRegisteredAt: string | null;
  testMode: boolean;
  ziina: { ok: boolean; name?: string; error?: string };
  zoho: { ok: boolean; name?: string; error?: string };
}

export default function SettingsPage() {
  const { t, lang } = useI18n();
  const [data, setData] = useState<SettingsResponse | null>(null);
  const [accounts, setAccounts] = useState<{ account_id: string; account_name: string; account_type: string }[]>([]);
  const [depositAccount, setDepositAccount] = useState("");
  const [defaultItem, setDefaultItem] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedWh, setCopiedWh] = useState(false);
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

  function copyWebhook() {
    if (!data?.webhookUrl) return;
    navigator.clipboard.writeText(data.webhookUrl);
    setCopiedWh(true);
    setTimeout(() => setCopiedWh(false), 1500);
  }

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <span>{t.loading}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{t.settings_page_title}</h1>
        <p className="mt-1 text-xs text-slate-500 max-w-2xl leading-relaxed">{t.brand_tagline}</p>
      </div>

      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}

      {/* 2-Column Responsive Grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Connectivity & Webhooks (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          {/* Connection Health Card */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand font-bold">
                <Radio className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">{t.connections_card_title}</h2>
            </div>

            <div className="space-y-3">
              {/* Ziina Connection */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">{t.ziina_connection}</span>
                  {data.testMode && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                      <ShieldAlert className="h-3 w-3" />
                      {t.test_mode}
                    </span>
                  )}
                </div>
                {data.ziina.ok ? (
                  <Badge tone="green" dot pulse>
                    {t.connected} {data.ziina.name ? `(${data.ziina.name})` : ""}
                  </Badge>
                ) : (
                  <Badge tone="red">{data.ziina.error || t.disconnected}</Badge>
                )}
              </div>

              {/* Zoho Connection */}
              <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <span className="text-xs font-bold text-slate-800">{t.zoho_connection}</span>
                {data.zoho.ok ? (
                  <Badge tone="green" dot pulse>
                    {t.connected} {data.zoho.name ? `(${data.zoho.name})` : ""}
                  </Badge>
                ) : (
                  <Badge tone="red">{data.zoho.error || t.disconnected}</Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Webhook Configuration Card */}
          <Card className="space-y-4">
            <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700 font-bold">
                <Webhook className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-slate-900">{t.webhook_card_title}</h2>
            </div>

            <p className="text-xs text-slate-500 leading-relaxed">{t.webhook_card_desc}</p>

            <div className="space-y-2">
              <label className="text-[11px] text-slate-400 uppercase tracking-wider">Webhook URL</label>
              <div className="flex items-center gap-2">
                <div className="num min-w-0 flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-mono select-all text-slate-700">
                  {data.webhookUrl}
                </div>
                <Button size="sm" variant="secondary" onClick={copyWebhook} title={t.copy}>
                  {copiedWh ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                </Button>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Button
                loading={busy === "wh"}
                disabled={!data.ziina.ok}
                size="md"
                onClick={() => {
                  const conf =
                    lang === "ar"
                      ? "سيتم استبدال أي Webhook مسجل حالياً في حساب Ziina. متابعة؟"
                      : "This will register this URL as the primary webhook in your Ziina account. Proceed?";
                  if (!confirm(conf)) return;
                  act("wh", { action: "register_webhook" }, lang === "ar" ? "تم تسجيل الـ Webhook بنجاح" : "Webhook registered successfully");
                }}
                className="w-full"
              >
                <Webhook className="h-4 w-4" />
                <span>{t.register_webhook_btn}</span>
              </Button>

              {data.webhookRegisteredAt && (
                <div className="num text-center text-[11px] text-slate-400">
                  {t.last_webhook_registered} {new Date(data.webhookRegisteredAt).toLocaleString("en-GB")}
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right Column: Zoho Books Accounting Settings (7 cols) */}
        <div className="lg:col-span-7">
          <Card className="h-full flex flex-col justify-between space-y-5">
            <div className="space-y-5">
              <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-50 text-sky-700 font-bold">
                  <Building className="h-4 w-4" />
                </div>
                <h2 className="text-sm font-bold text-slate-900">{t.zoho_config_title}</h2>
              </div>

              {/* Deposit Account */}
              <div>
                <label>{t.deposit_account_label}</label>
                <select value={depositAccount} onChange={(e) => setDepositAccount(e.target.value)}>
                  <option value="">{t.deposit_account_default}</option>
                  {accounts.map((a) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.account_name} ({a.account_type})
                    </option>
                  ))}
                </select>
                <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{t.deposit_account_hint}</p>
              </div>

              {/* Default Service Item */}
              <div>
                <label>{t.default_service_label}</label>
                {data.zoho.ok && <ItemPicker value={defaultItem} onChange={(id) => setDefaultItem(id)} />}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <Button
                loading={busy === "save"}
                size="lg"
                onClick={() =>
                  act(
                    "save",
                    { action: "save", zoho_deposit_account_id: depositAccount, default_item_id: defaultItem },
                    t.saved_success,
                  )
                }
                className="w-full sm:w-auto"
              >
                <Save className="h-4 w-4" />
                <span>{t.save_settings_btn}</span>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
