import Link from "next/link";
import { SAFETY_LABEL, type SafetyStatus, type ExpiryStatus } from "@/lib/logic";

export function PageHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h1 className="text-xl font-semibold text-slate-800">{title}</h1>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function LinkButton({ href, children, secondary }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return (
    <Link href={href} className={secondary ? "btn-secondary" : "btn"}>
      {children}
    </Link>
  );
}

const SAFETY_COLOR: Record<SafetyStatus, string> = {
  NEGATIVE: "bg-rose-700 text-white",
  LT1: "bg-rose-100 text-rose-700",
  LT2: "bg-amber-100 text-amber-800",
  LT3: "bg-sky-100 text-sky-800",
  OK: "bg-emerald-100 text-emerald-800",
  NONE: "bg-slate-100 text-slate-500",
};

export function SafetyBadge({ status }: { status: SafetyStatus }) {
  return <span className={`badge ${SAFETY_COLOR[status]}`}>{SAFETY_LABEL[status]}</span>;
}

const EXPIRY: Record<ExpiryStatus, [string, string]> = {
  EXPIRED: ["已過期", "bg-rose-700 text-white"],
  DANGER: ["即將到期", "bg-rose-100 text-rose-700"],
  WARN: ["注意效期", "bg-amber-100 text-amber-800"],
  OK: ["", ""],
  NONE: ["", ""],
};

export function ExpiryBadge({ status }: { status: ExpiryStatus }) {
  const [label, color] = EXPIRY[status];
  if (!label) return null;
  return <span className={`badge ${color}`}>{label}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-10 text-center text-sm text-slate-400">{children}</div>;
}

export function Notice({ kind = "info", children }: { kind?: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const color = {
    info: "border-sky-200 bg-sky-50 text-sky-800",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[kind];
  return <div className={`mb-4 rounded-md border px-3 py-2 text-sm ${color}`}>{children}</div>;
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
