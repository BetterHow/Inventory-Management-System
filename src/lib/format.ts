import { taipeiParts } from "./logic";

type Decimalish = { toNumber(): number } | number | string | null | undefined;

/** Prisma Decimal (or anything numeric) to a plain number. */
export function num(v: Decimalish): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  if (typeof v === "string") return Number(v);
  return v.toNumber();
}

export function fmtQty(v: Decimalish): string {
  const n = num(v);
  return n.toLocaleString("zh-TW", { maximumFractionDigits: 2 });
}

export function fmtMoney(v: Decimalish): string {
  const n = num(v);
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Date as YYYY-MM-DD in Taiwan time. For @db.Date columns pass utc=true. */
export function fmtDate(d: Date | null | undefined, utc = false): string {
  if (!d) return "";
  if (utc) return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  const p = taipeiParts(d);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "";
  const t = new Date(d.getTime() + 8 * 3600 * 1000);
  return `${fmtDate(d)} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}

/** "YYYY-MM-DD" to a Date for @db.Date columns (stored as UTC midnight). */
export function dateOnly(s: string): Date {
  return new Date(s + "T00:00:00Z");
}

export const MOVEMENT_LABEL: Record<string, string> = {
  RECEIPT: "進貨",
  CONSUME: "耗用",
  ADJUST: "盤點調整",
  TRANSFER_OUT: "調出",
  TRANSFER_IN: "調入",
  SCRAP: "報廢",
  RETURN: "退貨",
};

export const RECEIPT_STATUS_LABEL: Record<string, string> = {
  ORDERED: "待入庫",
  PENDING_INSPECTION: "待驗收",
  RECEIVED: "已入庫",
  CANCELLED: "已取消",
};

export const RECEIPT_STATUS_COLOR: Record<string, string> = {
  ORDERED: "bg-sky-100 text-sky-800",
  PENDING_INSPECTION: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-slate-200 text-slate-500",
};
