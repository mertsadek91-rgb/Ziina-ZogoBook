"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, MessageSquare, ExternalLink, QrCode } from "lucide-react";
import { Button } from "./ui";
import { useI18n } from "@/lib/i18n";

export function LinkResult({
  url,
  amountLabel,
  message,
}: {
  url: string;
  amountLabel: string;
  message?: string;
}) {
  const { t, lang } = useI18n();
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [url]);

  const shareText =
    lang === "ar"
      ? `${message ? message + "\n" : ""}المبلغ المطلوب: ${amountLabel}\nرابط الدفع المباشر: ${url}`
      : `${message ? message + "\n" : ""}Amount Due: ${amountLabel}\nDirect Payment Link: ${url}`;

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function copyWithMsg() {
    await navigator.clipboard.writeText(shareText);
    setCopiedMsg(true);
    setTimeout(() => setCopiedMsg(false), 1500);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 shadow-xs">
      <div className="flex items-center gap-2 text-sm font-bold text-emerald-900">
        <span>{t.link_created_success}</span>
        <span className="num rounded-lg bg-emerald-100 px-2 py-0.5 text-emerald-950 font-bold">
          {amountLabel}
        </span>
      </div>

      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        {qr && (
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <img src={qr} alt="QR Code" className="h-40 w-40 rounded-xl border border-emerald-200 bg-white p-2 shadow-2xs" />
            <span className="text-[10px] font-semibold text-emerald-700 flex items-center gap-1">
              <QrCode className="h-3 w-3" />
              <span>QR Code</span>
            </span>
          </div>
        )}

        <div className="w-full min-w-0 space-y-3">
          <div className="num break-all rounded-xl border border-emerald-200 bg-white p-3.5 text-xs text-slate-800 font-mono select-all shadow-2xs">
            {url}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="primary" onClick={copyLink}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copied ? t.copied : t.copy_link}</span>
            </Button>

            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
              <Button size="sm" variant="secondary" type="button">
                <span className="text-emerald-600 font-bold">💬</span>
                <span>{t.share_whatsapp}</span>
              </Button>
            </a>

            <Button size="sm" variant="secondary" type="button" onClick={copyWithMsg}>
              {copiedMsg ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <MessageSquare className="h-3.5 w-3.5 text-slate-500" />}
              <span>{copiedMsg ? t.copied : t.copy_with_message}</span>
            </Button>

            <a href={url} target="_blank" rel="noreferrer">
              <Button size="sm" variant="ghost" type="button">
                <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                <span>{t.open_link}</span>
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
