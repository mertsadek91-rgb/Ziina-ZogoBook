"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAcc } from "@/lib/i18n-acc";

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const { a } = useAcc();
  const path = usePathname();
  const tabs = [
    { href: "/accounting", label: a.tab_overview },
    { href: "/accounting/entries", label: a.tab_entries },
    { href: "/accounting/import", label: a.tab_import },
    { href: "/accounting/accounts", label: a.tab_accounts },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{a.title}</h1>
        <p className="mt-1 text-xs text-slate-500">{a.subtitle}</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1 shadow-xs">
        {tabs.map((t) => {
          const active = path === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-medium transition ${
                active ? "bg-brand text-white shadow-xs" : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
      {children}
    </div>
  );
}
