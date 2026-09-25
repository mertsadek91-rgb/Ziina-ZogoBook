import Link from "next/link";
import { LogoutButton } from "@/components/LogoutButton";

const NAV = [
  { href: "/payments", label: "الدفعات" },
  { href: "/links/new", label: "إنشاء رابط" },
  { href: "/quick-link", label: "رابط سريع" },
  { href: "/import", label: "استيراد" },
  { href: "/settings", label: "الإعدادات" },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const test = process.env.ZIINA_TEST_MODE === "true";
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 py-3">
          <Link href="/payments" className="shrink-0 font-bold text-brand">
            Ziina ↔ Zoho
          </Link>
          <nav className="flex shrink-0 gap-1">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className="rounded-lg px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex shrink-0 items-center gap-3">
            {test && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">وضع تجريبي</span>}
            <LogoutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
    </div>
  );
}
