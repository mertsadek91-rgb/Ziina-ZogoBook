"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "./ui";

export function LinkResult({ url, amountLabel, message }: { url: string; amountLabel: string; message?: string }) {
  const [qr, setQr] = useState<string>("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    QRCode.toDataURL(url, { width: 220, margin: 1 }).then(setQr).catch(() => setQr(""));
  }, [url]);

  const shareText = `${message ? message + "\n" : ""}المبلغ: ${amountLabel}\nرابط الدفع: ${url}`;

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4 rounded-xl border border-green-200 bg-green-50 p-5">
      <div className="text-sm font-medium text-green-800">تم إنشاء رابط الدفع بقيمة <span className="num">{amountLabel}</span></div>
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        {qr && <img src={qr} alt="QR" className="h-44 w-44 rounded-lg border bg-white p-1" />}
        <div className="w-full min-w-0 space-y-3">
          <div className="num break-all rounded-lg border bg-white p-3 text-left text-sm">{url}</div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={copy}>{copied ? "تم النسخ ✓" : "نسخ الرابط"}</Button>
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" type="button">مشاركة واتساب</Button>
            </a>
            <Button variant="secondary" type="button" onClick={() => navigator.clipboard.writeText(shareText)}>
              نسخ مع الرسالة
            </Button>
            <a href={url} target="_blank" rel="noreferrer">
              <Button variant="ghost" type="button">فتح الرابط</Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
