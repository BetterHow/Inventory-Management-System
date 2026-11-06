import "server-only";
import { prisma } from "./db";
import { fmtDate, num } from "./format";
import { expiryStatus, parseTaipeiDate, periodKey, periodRange, round2, todayTaipei, type Granularity } from "./logic";
import { stockOverview } from "./overview";
import { getSettings } from "./settings";

/** A report as a plain table, shown on the page and exported to Excel the same way. */
export type ReportTable = {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  numericFrom: number; // columns from this index are numbers
  totals?: (string | number)[];
};

export type ReportParams = {
  tab: string;
  warehouse?: string; // id or "all"
  from: string;
  to: string;
  g: Granularity;
  measure: "qty" | "amount";
  category?: string;
  days?: string;
};

export function defaultParams(sp: Record<string, string | undefined>): ReportParams {
  const today = todayTaipei();
  const d = parseTaipeiDate(today);
  const from = new Date(d.getTime() - 89 * 86400000);
  return {
    tab: sp.tab ?? "consumption",
    warehouse: sp.warehouse ?? "all",
    from: sp.from ?? fmtDate(from),
    to: sp.to ?? today,
    g: (sp.g as Granularity) ?? "month",
    measure: sp.measure === "amount" ? "amount" : "qty",
    category: sp.category,
    days: sp.days ?? "90",
  };
}

function range(p: ReportParams) {
  const from = parseTaipeiDate(p.from);
  const to = new Date(parseTaipeiDate(p.to).getTime() + 86400000 - 1); // end of day
  return { from, to };
}

const whFilter = (p: ReportParams) => (p.warehouse && p.warehouse !== "all" ? { warehouseId: Number(p.warehouse) } : {});

/** 耗用報表：每個品項在各期間的耗用量或金額。 */
export async function consumptionReport(p: ReportParams): Promise<ReportTable> {
  const { from, to } = range(p);
  const moves = await prisma.stockMovement.findMany({
    where: {
      type: "CONSUME",
      date: { gte: from, lte: to },
      ...whFilter(p),
      ...(p.category ? { item: { categoryId: Number(p.category) } } : {}),
    },
    include: { item: { include: { category: true } } },
  });
  const periods = periodRange(from, to, p.g);
  const byItem = new Map<number, { code: string; name: string; unit: string; cat: string; cells: Map<string, number>; qty: number; amount: number }>();
  for (const m of moves) {
    const q = -num(m.qty);
    const amt = q * num(m.unitCost);
    let r = byItem.get(m.itemId);
    if (!r) {
      r = { code: m.item.code, name: m.item.name, unit: m.item.unit, cat: m.item.category?.name ?? "", cells: new Map(), qty: 0, amount: 0 };
      byItem.set(m.itemId, r);
    }
    const k = periodKey(m.date, p.g);
    r.cells.set(k, (r.cells.get(k) ?? 0) + (p.measure === "qty" ? q : amt));
    r.qty += q;
    r.amount += amt;
  }
  const rows = [...byItem.values()]
    .sort((a, b) => b.amount - a.amount || a.code.localeCompare(b.code))
    .map((r) => [r.code, r.name, r.cat, r.unit, ...periods.map((k) => round2(r.cells.get(k) ?? 0)), round2(r.qty), round2(r.amount)]);
  const colTotals = periods.map((_, i) => round2(rows.reduce((s, r) => s + Number(r[4 + i]), 0)));
  return {
    title: `耗用報表（${p.measure === "qty" ? "數量" : "金額"}）${p.from} ~ ${p.to}`,
    headers: ["料號", "品名", "類別", "單位", ...periods, "合計數量", "合計金額"],
    rows,
    numericFrom: 4,
    totals: ["合計", "", "", "", ...colTotals, "", round2(rows.reduce((s, r) => s + Number(r[r.length - 1]), 0))],
  };
}

/** 進貨報表：各供應商在各期間的進貨金額（已入庫）。 */
export async function receivingReport(p: ReportParams): Promise<ReportTable> {
  const from = new Date(p.from + "T00:00:00Z");
  const to = new Date(p.to + "T00:00:00Z");
  const receipts = await prisma.receipt.findMany({
    where: { status: "RECEIVED", date: { gte: from, lte: to }, ...whFilter(p) },
    include: { supplier: true, invoice: true },
  });
  // Receipt dates are calendar dates; bucket them as Taiwan noon so they land on the right day.
  const at = (d: Date) => new Date(d.getTime() + 4 * 3600000);
  const periods = periodRange(parseTaipeiDate(p.from), parseTaipeiDate(p.to), p.g);
  const bySup = new Map<number, { name: string; cells: Map<string, number>; total: number; noInvoice: number; unpaid: number }>();
  for (const r of receipts) {
    let s = bySup.get(r.supplierId);
    if (!s) bySup.set(r.supplierId, (s = { name: r.supplier.name, cells: new Map(), total: 0, noInvoice: 0, unpaid: 0 }));
    const k = periodKey(at(r.date), p.g);
    const amt = num(r.totalAmount);
    s.cells.set(k, (s.cells.get(k) ?? 0) + amt);
    s.total += amt;
    if (!r.invoice) s.noInvoice += amt;
    else if (!r.invoice.paid) s.unpaid += amt;
  }
  const rows = [...bySup.values()]
    .sort((a, b) => b.total - a.total)
    .map((s) => [s.name, ...periods.map((k) => round2(s.cells.get(k) ?? 0)), round2(s.total), round2(s.noInvoice), round2(s.unpaid)]);
  const n = periods.length + 3;
  return {
    title: `進貨報表（金額）${p.from} ~ ${p.to}`,
    headers: ["供應商", ...periods, "合計", "未對發票", "已對發票未付"],
    rows,
    numericFrom: 1,
    totals: ["合計", ...Array.from({ length: n }, (_, i) => round2(rows.reduce((s, r) => s + Number(r[1 + i]), 0)))],
  };
}

/** 庫存金額報表：目前庫存與金額。 */
export async function stockValueReport(p: ReportParams): Promise<ReportTable> {
  const wid = p.warehouse && p.warehouse !== "all" ? Number(p.warehouse) : undefined;
  const rows = (await stockOverview(wid))
    .filter((r) => r.stock !== 0)
    .map((r) => [r.code, r.name, r.category, r.unit, r.stock, r.value]);
  return {
    title: `庫存金額 ${todayTaipei()}`,
    headers: ["料號", "品名", "類別", "單位", "庫存", "金額"],
    rows,
    numericFrom: 4,
    totals: ["合計", "", "", "", "", round2(rows.reduce((s, r) => s + Number(r[5]), 0))],
  };
}

/** 效期報表：N 天內到期（含已過期）且還有庫存的批號。 */
export async function expiryReport(p: ReportParams): Promise<ReportTable> {
  const settings = await getSettings();
  const days = Number(p.days ?? 90);
  const limit = new Date(Date.now() + days * 86400000);
  const batches = await prisma.batch.findMany({
    where: { qty: { gt: 0 }, expiryDate: { lte: limit }, ...whFilter(p) },
    include: { item: true, warehouse: true },
    orderBy: { expiryDate: "asc" },
  });
  const label = { EXPIRED: "已過期", DANGER: "即將到期", WARN: "注意", OK: "", NONE: "" };
  return {
    title: `${days} 天內到期批號`,
    headers: ["效期", "狀態", "庫別", "料號", "品名", "批號", "數量", "金額"],
    rows: batches.map((b) => [
      fmtDate(b.expiryDate, true),
      label[expiryStatus(b.expiryDate, new Date(), settings.expiryWarnDays, settings.expiryDangerDays)],
      b.warehouse.name,
      b.item.code,
      b.item.name,
      b.lotNo,
      num(b.qty),
      round2(num(b.qty) * num(b.unitCost)),
    ]),
    numericFrom: 6,
  };
}

export async function buildReport(p: ReportParams): Promise<ReportTable> {
  switch (p.tab) {
    case "receiving":
      return receivingReport(p);
    case "stock":
      return stockValueReport(p);
    case "expiry":
      return expiryReport(p);
    default:
      return consumptionReport(p);
  }
}
