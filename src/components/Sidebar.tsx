"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  CreditCard,
  PlusCircle,
  Zap,
  FileSpreadsheet,
  Settings,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  Calculator,
} from "lucide-react";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { LogoutButton } from "./LogoutButton";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  testMode?: boolean;
}

export function Sidebar({ collapsed, onToggleCollapse, testMode }: SidebarProps) {
  const pathname = usePathname();
  const { t, dir } = useI18n();

  const NAV_ITEMS = [
    { href: "/payments", label: t.nav_payments, icon: CreditCard, match: (p: string) => p.startsWith("/payments") },
    { href: "/links/new", label: t.nav_create_link, icon: PlusCircle, match: (p: string) => p === "/links/new" },
    { href: "/quick-link", label: t.nav_quick_link, icon: Zap, match: (p: string) => p === "/quick-link" },
    { href: "/import", label: t.nav_import, icon: FileSpreadsheet, match: (p: string) => p === "/import" },
    { href: "/accounting", label: t.nav_accounting, icon: Calculator, match: (p: string) => p.startsWith("/accounting") },
    { href: "/settings", label: t.nav_settings, icon: Settings, match: (p: string) => p === "/settings" },
  ];

  return (
    <aside
      className={`fixed top-0 bottom-0 z-30 hidden flex-col border-slate-200/80 bg-white shadow-xs transition-all duration-300 md:flex ${
        dir === "rtl" ? "right-0 border-l" : "left-0 border-r"
      } ${collapsed ? "w-20" : "w-64"}`}
    >
      {/* Brand Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-100 px-4">
        <Link href="/payments" className="flex items-center gap-3 overflow-hidden">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs border border-slate-100 p-1">
            <Image src="/logo.png" alt="Ziina ↔ Zoho" width={36} height={36} className="h-full w-full object-contain" priority />
          </div>
          {!collapsed && (
            <div className="flex flex-col truncate">
              <span className="font-bold text-slate-900 tracking-tight text-base">Ziina ↔ Zoho</span>
              <span className="text-[10px] font-medium text-slate-400 truncate">{t.brand_tagline}</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-2 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
          {!collapsed ? (dir === "rtl" ? "القائمة الرئيسية" : "Main Navigation") : "•••"}
        </div>
        <nav className="space-y-1.5">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            const Icon = item.icon;

            return (
              <div key={item.href} className="group relative">
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150 ${
                    active
                      ? "bg-brand text-white shadow-xs shadow-brand/20 font-bold"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  } ${collapsed ? "justify-center px-0" : ""}`}
                >
                  <Icon className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-slate-500 group-hover:text-slate-700"}`} />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>

                {/* Floating Tooltip when Collapsed */}
                {collapsed && (
                  <div
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-50 hidden whitespace-nowrap rounded-lg bg-slate-900 px-2.5 py-1 text-xs font-medium text-white shadow-lg group-hover:block ${
                      dir === "rtl" ? "right-full mr-2" : "left-full ml-2"
                    }`}
                  >
                    {item.label}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      {/* Sidebar Footer */}
      <div className="shrink-0 border-t border-slate-100 bg-slate-50/50 p-3 space-y-2">
        {/* Test Mode Badge */}
        {testMode && (
          <div
            className={`flex items-center gap-2 rounded-xl bg-amber-50 p-2 text-xs font-semibold text-amber-800 border border-amber-200/80 ${
              collapsed ? "justify-center" : ""
            }`}
            title={t.test_mode}
          >
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            {!collapsed && <span>{t.test_mode}</span>}
          </div>
        )}

        {/* Language Switcher */}
        <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"}`}>
          {!collapsed && <span className="text-xs font-medium text-slate-500">{dir === "rtl" ? "اللغة" : "Language"}</span>}
          <LanguageSwitcher compact={collapsed} />
        </div>

        {/* Logout */}
        <div className="pt-1 border-t border-slate-200/60">
          <LogoutButton collapsed={collapsed} />
        </div>

        {/* Collapse / Expand Toggle Button */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 text-xs font-medium text-slate-500 shadow-2xs hover:bg-slate-100 hover:text-slate-800 transition"
          title={collapsed ? t.nav_expand : t.nav_collapse}
        >
          {collapsed ? (
            dir === "rtl" ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : (
            <>
              {dir === "rtl" ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              <span>{t.nav_collapse}</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
