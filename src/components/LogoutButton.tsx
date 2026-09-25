"use client";

import { LogOut } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function LogoutButton({
  collapsed = false,
  className = "",
}: {
  collapsed?: boolean;
  className?: string;
}) {
  const { t } = useI18n();

  return (
    <button
      type="button"
      className={`group flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-slate-500 transition duration-150 hover:bg-rose-50 hover:text-rose-600 active:scale-[0.98] ${
        collapsed ? "justify-center" : "w-full"
      } ${className}`}
      title={t.nav_logout}
      onClick={async () => {
        await fetch("/api/auth/logout", { method: "POST" });
        location.href = "/login";
      }}
    >
      <LogOut className="h-4 w-4 shrink-0 transition-transform group-hover:-translate-x-0.5" />
      {!collapsed && <span>{t.nav_logout}</span>}
    </button>
  );
}
