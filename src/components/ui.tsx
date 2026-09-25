import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-xs hover:bg-brand-dark active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-brand/40",
  secondary: "border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]",
  danger: "bg-rose-600 text-white shadow-xs hover:bg-rose-700 active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-rose-400",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]",
  outline: "border border-brand/30 bg-brand-50/50 text-brand hover:bg-brand-100 active:scale-[0.98]",
};

const SIZES: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs font-medium gap-1.5 rounded-lg",
  md: "px-4 py-2 text-sm font-medium gap-2 rounded-xl",
  lg: "px-5 py-2.5 text-base font-semibold gap-2.5 rounded-xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      {...props}
      disabled={props.disabled || loading}
      className={`inline-flex items-center justify-center transition-all duration-150 select-none disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      )}
      {children}
    </button>
  );
}

export function Card({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs transition duration-200 ${
        hover ? "hover:border-slate-300 hover:shadow-md" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}

const TONES = {
  gray: "bg-slate-100 text-slate-700 border-slate-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
  yellow: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-rose-50 text-rose-700 border-rose-200",
  blue: "bg-sky-50 text-sky-700 border-sky-200",
  purple: "bg-purple-50 text-purple-700 border-purple-200",
};

const DOT_TONES = {
  gray: "bg-slate-400",
  green: "bg-emerald-500",
  yellow: "bg-amber-500",
  red: "bg-rose-500",
  blue: "bg-sky-500",
  purple: "bg-purple-500",
};

export function Badge({
  tone = "gray",
  dot = false,
  pulse = false,
  children,
}: {
  tone?: keyof typeof TONES;
  dot?: boolean;
  pulse?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${TONES[tone]}`}>
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${DOT_TONES[tone]}`} />}
          <span className={`relative inline-flex h-1.5 w-1.5 rounded-full ${DOT_TONES[tone]}`} />
        </span>
      )}
      {children}
    </span>
  );
}

export function ziinaTone(status: string): keyof typeof TONES {
  if (status === "completed") return "green";
  if (status === "failed" || status === "canceled") return "red";
  return "yellow";
}

export function zohoTone(status: string): keyof typeof TONES {
  if (status === "paid") return "green";
  if (status === "invoiced") return "blue";
  if (status === "error") return "red";
  if (status === "contact_ready") return "purple";
  return "gray";
}

export function Alert({ tone, children }: { tone: "error" | "success" | "info" | "warning"; children: ReactNode }) {
  const styles = {
    error: "border-rose-200 bg-rose-50/90 text-rose-800",
    success: "border-emerald-200 bg-emerald-50/90 text-emerald-800",
    info: "border-sky-200 bg-sky-50/90 text-sky-800",
    warning: "border-amber-200 bg-amber-50/90 text-amber-800",
  };

  const icons = {
    error: "⚠️",
    success: "✓",
    info: "ℹ️",
    warning: "⚡",
  };

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 text-sm font-medium shadow-2xs ${styles[tone]}`}>
      <span className="shrink-0 text-base leading-none">{icons[tone]}</span>
      <div className="flex-1 leading-relaxed">{children}</div>
    </div>
  );
}

export function KpiCard({
  title,
  value,
  subtext,
  icon,
  badge,
  active = false,
  onClick,
}: {
  title: string;
  value: ReactNode;
  subtext?: string;
  icon: ReactNode;
  badge?: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  const Component = onClick ? "button" : "div";
  return (
    <Component
      onClick={onClick}
      className={`group relative flex w-full flex-col justify-between rounded-2xl border p-4 text-start transition duration-150 ${
        active
          ? "border-brand bg-brand-50/40 ring-2 ring-brand/20 shadow-xs"
          : "border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-xs"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 group-hover:text-slate-700">{title}</span>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-50 text-slate-600 transition group-hover:bg-brand/10 group-hover:text-brand">
          {icon}
        </div>
      </div>
      <div className="mt-3 flex items-baseline justify-between gap-2">
        <div className="num text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{value}</div>
        {badge}
      </div>
      {subtext && <div className="num mt-1 text-xs text-slate-400">{subtext}</div>}
    </Component>
  );
}
