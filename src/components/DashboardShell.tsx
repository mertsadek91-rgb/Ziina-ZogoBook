"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  CreditCard,
  PlusCircle,
  Zap,
  FileSpreadsheet,
  Settings,
  ShieldAlert,
  Calculator,
} from "lucide-react";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
import { Sidebar } from "./Sidebar";
import { LogoutButton } from "./LogoutButton";

export function DashboardShell({
  children,
  testMode = false,
}: {
  children: React.ReactNode;
  testMode?: boolean;
}) {
  const pathname = usePathname();
  const { t, dir } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  // Restore collapsed state preference
  useEffect(() => {
    const saved = localStorage.getItem("sidebar_collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  function handleToggleCollapse() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar_collapsed", String(next));
      return next;
    });
  }

  // Close mobile drawer on route navigation
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const NAV_ITEMS = [
    { href: "/payments", label: t.nav_payments, icon: CreditCard, match: (p: string) => p.startsWith("/payments") },
    { href: "/links/new", label: t.nav_create_link, icon: PlusCircle, match: (p: string) => p === "/links/new" },
    { href: "/quick-link", label: t.nav_quick_link, icon: Zap, match: (p: string) => p === "/quick-link" },
    { href: "/import", label: t.nav_import, icon: FileSpreadsheet, match: (p: string) => p === "/import" },
    { href: "/accounting", label: t.nav_accounting, icon: Calculator, match: (p: string) => p.startsWith("/accounting") },
    { href: "/settings", label: t.nav_settings, icon: Settings, match: (p: string) => p === "/settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-50/70">
      {/* Desktop Collapsible Sidebar */}
      <Sidebar collapsed={collapsed} onToggleCollapse={handleToggleCollapse} testMode={testMode} />

      {/* Mobile Sticky Top Header */}
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur-md md:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95"
            aria-label="Open Navigation Menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <Link href="/payments" className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-xs text-white font-bold">⚡</span>
            <span className="font-bold text-slate-900 text-sm">Ziina ↔ Zoho</span>
          </Link>
        </div>

        <div className="flex items-center gap-2">
          {testMode && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200">
              <ShieldAlert className="h-3 w-3" />
              {t.test_mode}
            </span>
          )}
          <LanguageSwitcher />
        </div>
      </header>

      {/* Mobile Slide-over Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
          />

          {/* Drawer Panel */}
          <div
            className={`relative flex w-4/5 max-w-xs flex-col bg-white shadow-2xl transition-transform ${
              dir === "rtl" ? "mr-auto" : "ml-auto"
            }`}
          >
            {/* Header */}
            <div className="flex h-16 items-center justify-between border-b border-slate-100 px-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand text-white font-bold text-sm">
                  ⚡
                </div>
                <span className="font-bold text-slate-900 text-base">Ziina ↔ Zoho</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Links */}
            <nav className="flex-1 space-y-1.5 overflow-y-auto p-4">
              {NAV_ITEMS.map((item) => {
                const active = item.match(pathname);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-3 text-sm font-semibold transition ${
                      active
                        ? "bg-brand text-white shadow-xs font-bold"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon className={`h-5 w-5 shrink-0 ${active ? "text-white" : "text-slate-500"}`} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Drawer Footer */}
            <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-3">
              {testMode && (
                <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-2 text-xs font-semibold text-amber-800 border border-amber-200">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>{t.test_mode}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Language / اللغة</span>
                <LanguageSwitcher />
              </div>
              <div className="pt-2 border-t border-slate-200">
                <LogoutButton />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area - dynamically adjusted margins based on sidebar collapse */}
      <div
        className={`transition-all duration-300 ease-in-out ${
          dir === "rtl"
            ? collapsed ? "md:mr-20" : "md:mr-64"
            : collapsed ? "md:ml-20" : "md:ml-64"
        }`}
      >
        <main className="mx-auto max-w-7xl px-4 py-6 pb-28 sm:px-6 md:py-8 md:pb-12">{children}</main>
      </div>

      {/* Mobile Bottom Quick-Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 flex h-16 items-center justify-around border-t border-slate-200/90 bg-white/95 px-2 backdrop-blur-md md:hidden shadow-lg">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 py-1 px-2 text-[10px] font-semibold transition active:scale-95 ${
                active ? "text-brand font-bold" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${active ? "bg-brand/10 text-brand" : ""}`}>
                <Icon className="h-4 w-4" />
              </div>
              <span className="truncate max-w-[64px]">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
