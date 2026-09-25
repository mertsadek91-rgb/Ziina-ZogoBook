export type Tab = "pending" | "to_invoice" | "review" | "invoiced" | "done" | "errors" | "failed" | "all" | "archived";

export const TABS: { key: Tab; label: string }[] = [
  { key: "to_invoice", label: "مدفوع – بدون فاتورة" },
  { key: "review", label: "تطابق محتمل – للمراجعة" },
  { key: "invoiced", label: "فاتورة بدون دفعة" },
  { key: "done", label: "مكتمل" },
  { key: "pending", label: "بانتظار الدفع" },
  { key: "errors", label: "أخطاء الترحيل" },
  { key: "failed", label: "فشل / ملغي" },
  { key: "all", label: "الكل" },
  { key: "archived", label: "المخفية" },
];

const PENDING = ["requires_payment_instrument", "requires_user_action", "pending"];

export interface StatusLike {
  status: string;
  zohoStatus: string;
  zohoCandidateCount?: number;
  archived?: boolean;
}

const UNLINKED = ["not_synced", "contact_ready"];

export function tabOf(p: StatusLike): Exclude<Tab, "all"> {
  if (p.archived) return "archived";
  if (p.status === "failed" || p.status === "canceled" || p.status === "refunded") return "failed";
  if (PENDING.includes(p.status)) return "pending";
  // completed
  if (p.zohoStatus === "error") return "errors";
  if (p.zohoStatus === "paid") return "done";
  if (p.zohoStatus === "invoiced") return "invoiced";
  if ((p.zohoCandidateCount ?? 0) > 0) return "review";
  return "to_invoice";
}

/** Prisma `where` fragment for a tab. */
export function whereForTab(tab: Tab): Record<string, unknown> {
  if (tab === "archived") return { archived: true };
  return { archived: false, ...visibleWhere(tab) };
}

function visibleWhere(tab: Tab): Record<string, unknown> {
  switch (tab) {
    case "pending":
      return { status: { in: PENDING } };
    case "failed":
      return { status: { in: ["failed", "canceled", "refunded"] } };
    case "errors":
      return { status: "completed", zohoStatus: "error" };
    case "done":
      return { status: "completed", zohoStatus: "paid" };
    case "invoiced":
      return { status: "completed", zohoStatus: "invoiced" };
    case "to_invoice":
      return { status: "completed", zohoStatus: { in: UNLINKED }, zohoCandidateCount: 0 };
    case "review":
      return { status: "completed", zohoStatus: { in: UNLINKED }, zohoCandidateCount: { gt: 0 } };
    default:
      return {};
  }
}

export const ZIINA_STATUS_LABEL: Record<string, string> = {
  requires_payment_instrument: "بانتظار الدفع",
  requires_user_action: "بانتظار إجراء العميل",
  pending: "قيد المعالجة",
  completed: "مدفوع",
  failed: "فشل",
  canceled: "ملغي",
  refunded: "مسترد",
};

export const ZOHO_STATUS_LABEL: Record<string, string> = {
  not_synced: "لم تُصدر فاتورة",
  contact_ready: "العميل جاهز",
  invoiced: "فاتورة بدون دفعة",
  paid: "فاتورة + دفعة",
  error: "خطأ",
};
