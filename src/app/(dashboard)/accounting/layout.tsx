"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PieChart, BookOpen, UploadCloud, Users, Calculator } from "lucide-react";
import { useAcc } from "@/lib/i18n-acc";

export default function AccountingLayout({ children }: { children: React.ReactNode }) {
  const { a } = useAcc();
  const path = usePathname();

  const tabs = [
    { href: "/accounting", label: a.tab_overview, icon: PieChart },
    { href: "/accounting/entries", label: a.tab_entries, icon: BookOpen },
    { href: "/accounting/import", label: a.tab_import, icon: UploadCloud },
    { href: "/accounting/accounts", label: a.tab_accounts, icon: Users },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand to-brand-light text-white shadow-xs">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{a.title}</h1>
          <p className="mt-0.5 text-xs text-slate-500">{a.subtitle}</p>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <nav className="flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white p-1.5 shadow-xs">
        {tabs.map((t) => {
          const active = path === t.href;
          const Icon = t.icon;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all duration-150 ${
                active
                  ? "bg-brand text-white shadow-xs shadow-brand/20 font-bold"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? "text-white" : "text-slate-400"}`} />
              <span>{t.label}</span>
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}
