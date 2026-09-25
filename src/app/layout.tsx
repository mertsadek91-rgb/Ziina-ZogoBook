import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Inter } from "next/font/google";
import { I18nProvider } from "@/lib/i18n";
import "./globals.css";

const fontArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
});

const fontInter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ziina ↔ Zoho | Integration & Invoicing Platform",
  description: "متابعة وتدقيق دفعات Ziina وإصدار فواتير Zoho Books آلياً",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${fontArabic.variable} ${fontInter.variable}`}>
      <body className="min-h-screen bg-slate-50/60 font-sans text-slate-900 antialiased selection:bg-brand/10 selection:text-brand">
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
