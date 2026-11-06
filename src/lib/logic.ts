// Pure business rules with no database access, so they can be unit tested.

export type BatchLike = {
  id: number;
  qty: number;
  expiryDate: Date | null;
  createdAt: Date;
};

export type Allocation = { batchId: number | null; qty: number };

/** Sort batches so the one that expires first is used first. Batches without an expiry date go last. */
export function sortFefo<T extends BatchLike>(batches: T[]): T[] {
  return [...batches].sort((a, b) => {
    const ea = a.expiryDate ? a.expiryDate.getTime() : Infinity;
    const eb = b.expiryDate ? b.expiryDate.getTime() : Infinity;
    if (ea !== eb) return ea - eb;
    return a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id;
  });
}

/**
 * Decide which batches to take `need` units from (first-expiring first).
 * Negative stock is allowed: whatever can't be covered is taken from the
 * last batch in order (or from a new batch when none exists, batchId null).
 */
export function allocateFefo(batches: BatchLike[], need: number): { allocations: Allocation[]; shortfall: number } {
  const sorted = sortFefo(batches);
  const allocations: Allocation[] = [];
  let remaining = round2(need);
  for (const b of sorted) {
    if (remaining <= 0) break;
    if (b.qty <= 0) continue;
    const take = Math.min(b.qty, remaining);
    allocations.push({ batchId: b.id, qty: round2(take) });
    remaining = round2(remaining - take);
  }
  const shortfall = remaining > 0 ? remaining : 0;
  if (shortfall > 0) {
    const last = sorted[sorted.length - 1];
    const target = last ? last.id : null;
    const existing = allocations.find((a) => a.batchId === target && target !== null);
    if (existing) existing.qty = round2(existing.qty + shortfall);
    else allocations.push({ batchId: target, qty: shortfall });
  }
  return { allocations, shortfall };
}

export type SafetyStatus = "NEGATIVE" | "LT1" | "LT2" | "LT3" | "OK" | "NONE";

/** Compare stock with monthly usage: below 1 month, 2 months, 3 months, or fine. */
export function safetyStatus(stock: number, monthlyUsage: number | null): SafetyStatus {
  if (stock < 0) return "NEGATIVE";
  if (!monthlyUsage || monthlyUsage <= 0) return "NONE";
  if (stock < monthlyUsage) return "LT1";
  if (stock < monthlyUsage * 2) return "LT2";
  if (stock < monthlyUsage * 3) return "LT3";
  return "OK";
}

export const SAFETY_LABEL: Record<SafetyStatus, string> = {
  NEGATIVE: "負庫存",
  LT1: "不足1個月",
  LT2: "不足2個月",
  LT3: "不足3個月",
  OK: "庫存良好",
  NONE: "無耗用資料",
};

/** Average monthly usage (30 days) from the total used over `days` days. */
export function monthlyFromTotal(totalUsed: number, days: number): number {
  if (days <= 0) return 0;
  return round2((totalUsed / days) * 30);
}

export type ExpiryStatus = "EXPIRED" | "DANGER" | "WARN" | "OK" | "NONE";

export function expiryStatus(expiry: Date | null, today: Date, warnDays: number, dangerDays: number): ExpiryStatus {
  if (!expiry) return "NONE";
  const days = Math.floor((startOfDay(expiry).getTime() - startOfDay(today).getTime()) / 86400000);
  if (days < 0) return "EXPIRED";
  if (days <= dangerDays) return "DANGER";
  if (days <= warnDays) return "WARN";
  return "OK";
}

export type Granularity = "day" | "week" | "month" | "quarter" | "year";

const TZ_OFFSET_MS = 8 * 3600 * 1000; // Asia/Taipei, no daylight saving

/** Calendar parts of a timestamp in Taiwan time. */
export function taipeiParts(d: Date) {
  const t = new Date(d.getTime() + TZ_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), dow: t.getUTCDay() };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Label of the reporting period a timestamp falls in (Taiwan time). Weeks start on Monday. */
export function periodKey(date: Date, g: Granularity): string {
  const p = taipeiParts(date);
  switch (g) {
    case "day":
      return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
    case "week": {
      const back = (p.dow + 6) % 7; // days since Monday
      const monday = new Date(Date.UTC(p.y, p.m - 1, p.d - back));
      return `${monday.getUTCFullYear()}-${pad(monday.getUTCMonth() + 1)}-${pad(monday.getUTCDate())} 週`;
    }
    case "month":
      return `${p.y}-${pad(p.m)}`;
    case "quarter":
      return `${p.y} Q${Math.floor((p.m - 1) / 3) + 1}`;
    case "year":
      return `${p.y}`;
  }
}

/** All period labels between two dates, in order, so empty periods still show as 0. */
export function periodRange(from: Date, to: Date, g: Granularity): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const step = 86400000;
  for (let t = from.getTime(); t <= to.getTime(); t += step) {
    const k = periodKey(new Date(t), g);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  const last = periodKey(to, g);
  if (!seen.has(last)) keys.push(last);
  return keys;
}

/** Parse "YYYY-MM-DD" as midnight Taiwan time. */
export function parseTaipeiDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) - TZ_OFFSET_MS);
}

/** Today's date in Taiwan as "YYYY-MM-DD". */
export function todayTaipei(now = new Date()): string {
  const p = taipeiParts(now);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function sum(nums: number[]): number {
  return round2(nums.reduce((a, b) => a + b, 0));
}

/**
 * Timestamp for a stock movement entered for a given day:
 * now if the day is today (Taiwan), otherwise noon of that day.
 */
export function movementTime(dateStr: string, now = new Date()): Date {
  if (dateStr === todayTaipei(now)) return now;
  return new Date(parseTaipeiDate(dateStr).getTime() + 12 * 3600000);
}
