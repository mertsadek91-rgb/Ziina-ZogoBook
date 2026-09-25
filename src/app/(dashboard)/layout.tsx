import { DashboardShell } from "@/components/DashboardShell";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const testMode = process.env.ZIINA_TEST_MODE === "true";

  return <DashboardShell testMode={testMode}>{children}</DashboardShell>;
}
