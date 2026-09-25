"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Alert, Button } from "@/components/ui";

function LoginForm() {
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
      setError((await res.json().catch(() => ({}))).error ?? "فشل تسجيل الدخول");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="text-center text-xl font-bold text-brand">Ziina ↔ Zoho</h1>
      {error && <Alert tone="error">{error}</Alert>}
      <div>
        <label>كلمة المرور</label>
        <input type="password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <Button type="submit" loading={busy} className="w-full">
        دخول
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
