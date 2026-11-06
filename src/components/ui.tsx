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

/** A "cancel" button next to save: leaves the form without saving anything. */
export function CancelLink({ href, label = "取消" }: { href: string; label?: string }) {
  return <Link href={href} className="btn-secondary">{label}</Link>;
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

/** Builds a link to the same page with some search params changed (empty value = removed). */
export function withParams(path: string, sp: Record<string, string | undefined>, changes: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...sp, ...changes })) if (v && !["ok", "error", "warn"].includes(k)) q.set(k, v);
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

/** Pill-shaped filter links, e.g. warehouses or statuses. */
export function Pills({ items }: { items: { href: string; label: string; active: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((it) => (
        <Link key={it.href + it.label} href={it.href}
          className={`rounded-full px-3 py-1 text-sm ${it.active ? "bg-teal-600 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}

/** Warehouse pills for list pages. "全部庫別" passes warehouse=all so the user's own warehouse isn't re-applied. */
export function WarehousePills({ path, sp, warehouses, current, mine }: {
  path: string;
  sp: Record<string, string | undefined>;
  warehouses: { id: number; name: string }[];
  current: number | undefined;
  mine?: number | null;
}) {
  return (
    <Pills items={[
      { href: withParams(path, sp, { warehouse: "all" }), label: "全部庫別", active: current === undefined },
      ...warehouses.map((w) => ({
        href: withParams(path, sp, { warehouse: String(w.id) }),
        label: w.id === mine ? `${w.name}（目前單位）` : w.name,
        active: current === w.id,
      })),
    ]} />
  );
}

export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
