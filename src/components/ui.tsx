import Link from "next/link";
import { SAFETY_LABEL, type SafetyStatus, type ExpiryStatus } from "@/lib/logic";

export function PageHeader({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
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
  NEGATIVE: "bg-rose-600 text-white",
  LT1: "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200",
  LT2: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200",
  LT3: "bg-sky-50 text-sky-800 ring-1 ring-inset ring-sky-200",
  OK: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200",
  NONE: "bg-slate-50 text-slate-500 ring-1 ring-inset ring-slate-200",
};

export function SafetyBadge({ status }: { status: SafetyStatus }) {
  return <span className={`badge ${SAFETY_COLOR[status]}`}>{SAFETY_LABEL[status]}</span>;
}

const EXPIRY: Record<ExpiryStatus, [string, string]> = {
  EXPIRED: ["已過期", "bg-rose-600 text-white"],
  DANGER: ["即將到期", "bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200"],
  WARN: ["注意效期", "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200"],
  OK: ["", ""],
  NONE: ["", ""],
};

export function ExpiryBadge({ status }: { status: ExpiryStatus }) {
  const [label, color] = EXPIRY[status];
  if (!label) return null;
  return <span className={`badge ${color}`}>{label}</span>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="py-12 text-center text-sm text-slate-400">{children}</div>;
}

export function Notice({ kind = "info", children }: { kind?: "info" | "warn" | "ok"; children: React.ReactNode }) {
  const color = {
    info: "border-sky-200 bg-sky-50 text-sky-800",
    warn: "border-amber-300 bg-amber-50 text-amber-900",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
  }[kind];
  return <div className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${color}`}>{children}</div>;
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
          className={`rounded-full border px-3.5 py-1 text-sm transition-colors ${it.active ? "border-teal-600 bg-teal-600 font-medium text-white shadow-sm shadow-teal-900/10" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"}`}>
          {it.label}
        </Link>
      ))}
    </div>
  );
}

/** Warehouse pills for list pages. "全部庫別" passes warehouse=all so the user's own warehouse isn't re-applied. */
export function WarehousePills({ path, sp, warehouses, current, mine, all = true }: {
  all?: boolean; // false for people with hidden warehouses: no combined view
  path: string;
  sp: Record<string, string | undefined>;
  warehouses: { id: number; name: string }[];
  current: number | undefined;
  mine?: number | null;
}) {
  return (
    <Pills items={[
      ...(all ? [{ href: withParams(path, sp, { warehouse: "all" }), label: "全部庫別", active: current === undefined }] : []),
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
