"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Lock, ArrowRight, ArrowLeft } from "lucide-react";
import { Alert, Button } from "@/components/ui";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";

function LoginForm() {
  const { t, dir } = useI18n();
  const next = useSearchParams().get("next") || "/payments";
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      location.href = next.startsWith("/") ? next : "/payments";
    } else {
      setError((await res.json().catch(() => ({}))).error ?? t.login_failed_msg);
      setBusy(false);
    }
  }

  return (
    <div className="relative w-full max-w-sm">
      {/* Language Switcher Float */}
      <div className="flex justify-end mb-3">
        <LanguageSwitcher />
      </div>

      <form onSubmit={submit} className="space-y-5 rounded-3xl border border-slate-200/90 bg-white p-7 shadow-lg">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-sm border border-slate-100 p-2">
            <Image src="/logo.png" alt="Ziina ↔ Zoho" width={56} height={56} className="h-full w-full object-contain" priority />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight text-slate-900">Ziina ↔ Zoho</h1>
          <p className="text-xs text-slate-500">{t.login_welcome}</p>
        </div>

        {error && <Alert tone="error">{error}</Alert>}

        <div>
          <label>{t.password_label}</label>
          <div className="relative">
            <Lock className="pointer-events-none absolute top-1/2 -translate-y-1/2 ms-3 h-4 w-4 text-slate-400" />
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="ps-9"
              placeholder="••••••••"
            />
          </div>
        </div>

        <Button type="submit" loading={busy} size="lg" className="w-full">
          <span>{t.login_submit}</span>
          {dir === "rtl" ? <ArrowLeft className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 bg-slate-50/80">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
