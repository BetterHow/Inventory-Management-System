import "server-only";
import { prisma } from "./db";
import { num } from "./format";
import { parseTaipeiDate, taipeiParts, todayTaipei } from "./logic";

import { getSettings } from "./settings";
import { priceLookup } from "./prices";

/** Consumption whose note has one of these words (系統設定) earns nothing: cost only, no 售價. */
async function noRevenueTest() {
  const words = (await getSettings()).noRevenueNotes;
  return { words, test: (note: string | null | undefined) => Boolean(note && words.some((w) => note.includes(w))) };
}

export type Period = { key: string; label: string; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
function addMonths(y: number, m: number, k: number) {
  const t = y * 12 + (m - 1) + k;
  return { y: Math.floor(t / 12), m: (t % 12) + 1 };
}

export const PERIODS: [string, string][] = [
  ["month", "本月"],
  ["lastmonth", "上個月"],
  ["3m", "近 3 個月"],
  ["6m", "近 6 個月"],
  ["year", "今年"],
];

/** Turns the page's period choice (or a custom from/to) into dates, plus the same-length period before it for comparison. */
export function resolvePeriod(sp: Record<string, string | undefined>): { cur: Period; prev: Period } {
  const t = taipeiParts(new Date());
  const today = todayTaipei();
  let cur: Period;
  const key = sp.from || sp.to ? "custom" : sp.period ?? "month";
  if (key === "custom") {
    const from = sp.from || ymd(t.y, t.m, 1);
    const to = sp.to || today;
    cur = { key, label: `${from} ～ ${to}`, from, to };
  } else if (key === "lastmonth") {
    const p = addMonths(t.y, t.m, -1);
    cur = { key, label: `${p.y}年${p.m}月`, from: ymd(p.y, p.m, 1), to: ymd(p.y, p.m, lastDay(p.y, p.m)) };
  } else if (key === "3m" || key === "6m") {
    const n = key === "3m" ? 3 : 6;
    const s = addMonths(t.y, t.m, -(n - 1));
    cur = { key, label: `${s.y}年${s.m}月 ～ ${t.y}年${t.m}月`, from: ymd(s.y, s.m, 1), to: today };
  } else if (key === "year") {
    cur = { key, label: `${t.y}年`, from: ymd(t.y, 1, 1), to: today };
  } else {
    cur = { key: "month", label: `${t.y}年${t.m}月`, from: ymd(t.y, t.m, 1), to: today };
  }
  // Previous period: same number of days, right before.
  const f = parseTaipeiDate(cur.from).getTime();
  const days = Math.round((parseTaipeiDate(cur.to).getTime() - f) / 86400000) + 1;
  const pf = new Date(f - days * 86400000 + 8 * 3600000);
  const pt = new Date(f - 86400000 + 8 * 3600000);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const prev = { key: "prev", label: "前一期", from: iso(pf), to: iso(pt) };
  return { cur, prev };
}

/** margin = 售價 − 成本 of the priced, earning consumption; net = margin − 贈送／損耗成本. */
type Totals = { cost: number; sale: number; margin: number; net: number; pricedCost: number; noRevenueCost: number; received: number };

export type ItemRow = { id: number; code: string; name: string; unit: string; qty: number; cost: number; sale: number; margin: number; priced: boolean };
export type CatRow = { name: string; cost: number; sale: number; margin: number };
export type PurposeRow = { name: string; cost: number; sale: number; margin: number; revenue: boolean };
export type TypeRow = { key: string; name: string; qty: number; cost: number; sale: number; margin: number };
export type MonthRow = { key: string; label: string; cost: number; sale: number; margin: number; net: number; received: number };

const end = (to: string) => new Date(parseTaipeiDate(to).getTime() + 86400000 - 1);

async function consumption(from: string, to: string, wid?: number) {
  const moves = await prisma.stockMovement.findMany({
    where: { type: "CONSUME", date: { gte: parseTaipeiDate(from), lte: end(to) }, ...(wid ? { warehouseId: wid } : {}) },
    select: { date: true, qty: true, unitCost: true, itemId: true, refType: true, refId: true, revenue: true, priceType: true },
  });
  const ids = [...new Set(moves.filter((m) => m.refType === "CONSUMPTION" && m.refId).map((m) => m.refId!))];
  const notes = new Map(
    (await prisma.consumption.findMany({ where: { id: { in: ids } }, select: { id: true, note: true } })).map((c) => [c.id, c.note]),
  );
  return moves.map((m) => {
    const note = m.refType === "CONSUMPTION" && m.refId ? notes.get(m.refId) ?? null : null;
    return {
      date: m.date, itemId: m.itemId, qty: -num(m.qty), cost: -num(m.qty) * num(m.unitCost), note,
      revenue: m.revenue == null ? null : num(m.revenue), priceType: m.priceType,
    };
  });
}

async function receivedTotal(from: string, to: string, wid?: number) {
  const r = await prisma.receipt.aggregate({
    where: { status: "RECEIVED", date: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T00:00:00Z") }, ...(wid ? { warehouseId: wid } : {}) },
    _sum: { totalAmount: true },
  });
  return num(r._sum.totalAmount);
}

type Row = Awaited<ReturnType<typeof consumption>>[number];

/**
 * What one consumption row earned. HIS imports carry the report's actual amount; manual entries use the
 * item's 健保價／售價 on that day. `null` = no price known. `free` = 贈送／損耗 (cost only).
 */
async function earner() {
  const [priceAt, { words, test }] = await Promise.all([priceLookup(), noRevenueTest()]);
  const earn = (r: Row): { free: boolean; sale: number | null } => {
    if (r.priceType === "FREE") return { free: true, sale: 0 };
    if (r.revenue != null) return { free: false, sale: r.revenue };
    if (test(r.note)) return { free: true, sale: 0 };
    const p = priceAt(r.itemId, r.date);
    return { free: false, sale: p == null ? null : r.qty * p };
  };
  return { earn, words };
}

export const TYPE_LABEL: Record<string, string> = { NHI: "健保", SELF: "自費", FREE: "贈送", MANUAL: "手動登記" };

export async function analytics(cur: Period, prev: Period, wid?: number) {
  const [items, { earn, words }] = await Promise.all([
    prisma.item.findMany({ include: { category: true } }),
    earner(),
  ]);
  const noRevenue = (r: Row) => earn(r).free;
  const itemMap = new Map(items.map((i) => [i.id, i]));

  function summarize(rows: Awaited<ReturnType<typeof consumption>>, received: number): Totals {
    const t: Totals = { cost: 0, sale: 0, margin: 0, net: 0, pricedCost: 0, noRevenueCost: 0, received };
    for (const r of rows) {
      t.cost += r.cost;
      const e = earn(r);
      if (e.free) t.noRevenueCost += r.cost;
      else if (e.sale != null) {
        t.sale += e.sale;
        t.pricedCost += r.cost;
      }
    }
    t.margin = t.sale - t.pricedCost;
    t.net = t.margin - t.noRevenueCost;
    return t;
  }

  const [curRows, prevRows, curRec, prevRec] = await Promise.all([
    consumption(cur.from, cur.to, wid),
    consumption(prev.from, prev.to, wid),
    receivedTotal(cur.from, cur.to, wid),
    receivedTotal(prev.from, prev.to, wid),
  ]);
  const totals = summarize(curRows, curRec);
  const prevTotals = summarize(prevRows, prevRec);

  // Per item, per category, per purpose (the consumption note)
  const byItem = new Map<number, ItemRow>();
  const byCat = new Map<string, CatRow>();
  const byPurpose = new Map<string, PurposeRow>();
  const byType = new Map<string, TypeRow>();
  for (const r of curRows) {
    const it = itemMap.get(r.itemId);
    if (!it) continue;
    const e = earn(r);
    const priced = e.free || e.sale != null;
    const earns = !e.free && e.sale != null;
    const sale = earns ? e.sale! : 0;
    const margin = earns ? sale - r.cost : 0;
    const tkey = r.priceType ?? "MANUAL";
    const tr = byType.get(tkey) ?? { key: tkey, name: TYPE_LABEL[tkey] ?? tkey, qty: 0, cost: 0, sale: 0, margin: 0 };
    tr.qty += r.qty; tr.cost += r.cost; tr.sale += sale; tr.margin += margin;
    byType.set(tkey, tr);
    const row = byItem.get(it.id) ?? { id: it.id, code: it.code, name: it.name, unit: it.unit, qty: 0, cost: 0, sale: 0, margin: 0, priced };
    row.qty += r.qty; row.cost += r.cost; row.sale += sale; row.margin += margin;
    row.priced ||= priced;
    byItem.set(it.id, row);
    const cname = it.category?.name ?? "未分類";
    const c = byCat.get(cname) ?? { name: cname, cost: 0, sale: 0, margin: 0 };
    c.cost += r.cost; c.sale += sale; c.margin += margin;
    byCat.set(cname, c);
    const pname = r.note?.trim() || "（未填用途）";
    const p = byPurpose.get(pname) ?? { name: pname, cost: 0, sale: 0, margin: 0, revenue: !noRevenue(r) };
    p.cost += r.cost; p.sale += sale; p.margin += margin;
    byPurpose.set(pname, p);
  }
  const itemRows = [...byItem.values()];

  // Last 12 months trend (independent of the chosen period)
  const t = taipeiParts(new Date());
  const start = addMonths(t.y, t.m, -11);
  const tFrom = ymd(start.y, start.m, 1);
  const [trendRows, trendRec] = await Promise.all([
    consumption(tFrom, todayTaipei(), wid),
    prisma.receipt.findMany({
      where: { status: "RECEIVED", date: { gte: new Date(tFrom + "T00:00:00Z") }, ...(wid ? { warehouseId: wid } : {}) },
      select: { date: true, totalAmount: true },
    }),
  ]);
  const months: MonthRow[] = [];
  for (let k = 0; k < 12; k++) {
    const p = addMonths(start.y, start.m, k);
    months.push({ key: `${p.y}-${pad(p.m)}`, label: `${p.m}月`, cost: 0, sale: 0, margin: 0, net: 0, received: 0 });
  }
  const idx = new Map(months.map((m, i) => [m.key, i]));
  for (const r of trendRows) {
    const p = taipeiParts(r.date);
    const m = months[idx.get(`${p.y}-${pad(p.m)}`) ?? -1];
    if (!m) continue;
    m.cost += r.cost;
    const e = earn(r);
    if (e.free) m.net -= r.cost;
    else if (e.sale != null) {
      m.sale += e.sale;
      m.margin += e.sale - r.cost;
      m.net += e.sale - r.cost;
    }
  }
  for (const r of trendRec) {
    const m = months[idx.get(r.date.toISOString().slice(0, 7)) ?? -1];
    if (m) m.received += num(r.totalAmount);
  }

  return {
    noRevenueWords: words,
    totals,
    prevTotals,
    months,
    categories: [...byCat.values()].sort((a, b) => b.cost - a.cost),
    purposes: [...byPurpose.values()].sort((a, b) => b.cost - a.cost),
    types: [...byType.values()].sort((a, b) => b.sale - a.sale || b.cost - a.cost),
    topCost: [...itemRows].sort((a, b) => b.cost - a.cost).slice(0, 10),
    topMargin: itemRows.filter((r) => r.priced && r.sale > 0).sort((a, b) => b.margin - a.margin).slice(0, 10),
    unpriced: itemRows.filter((r) => !r.priced).sort((a, b) => b.cost - a.cost),
  };
}

/** 價差 for one period (used on the dashboard). */
export async function periodMargin(from: string, to: string, wid?: number) {
  const [rows, { earn }] = await Promise.all([consumption(from, to, wid), earner()]);
  let sale = 0, cost = 0;
  for (const r of rows) {
    const e = earn(r);
    if (e.free || e.sale == null) continue;
    sale += e.sale;
    cost += r.cost;
  }
  return { sale, margin: sale - cost };
}

// ---------- 品項分析 ----------

export type ItemAnalysisRow = {
  id: number; code: string; name: string; unit: string; category: string;
  qty: number; prevQty: number; cost: number; sale: number; margin: number; rx: number;
  share: number; abc: "A" | "B" | "C"; stock: number; daysLeft: number | null;
};

/** ABC: items sorted by cost; the ones making up the first 80% are A, the next 15% B, the rest C. */
export function abcClass<T extends { cost: number }>(rows: T[]): Map<T, "A" | "B" | "C"> {
  const sorted = [...rows].sort((a, b) => b.cost - a.cost);
  const total = sorted.reduce((s, r) => s + Math.max(r.cost, 0), 0);
  const out = new Map<T, "A" | "B" | "C">();
  let run = 0;
  for (const r of sorted) {
    const before = total ? run / total : 1;
    out.set(r, before < 0.8 ? "A" : before < 0.95 ? "B" : "C");
    run += Math.max(r.cost, 0);
  }
  return out;
}

/** Per item: quantity used this period vs the period before, money, ABC class and how long the stock lasts. */
export async function itemAnalysis(cur: Period, prev: Period, wid?: number) {
  const [items, { earn }, curRows, prevRows, batches, rx] = await Promise.all([
    prisma.item.findMany({ include: { category: true } }),
    earner(),
    consumption(cur.from, cur.to, wid),
    consumption(prev.from, prev.to, wid),
    prisma.batch.groupBy({ by: ["itemId"], where: wid ? { warehouseId: wid } : {}, _sum: { qty: true } }),
    prisma.hisImportLine.groupBy({
      by: ["itemId"],
      where: { import: { dateTo: { gte: new Date(cur.from + "T00:00:00Z"), lte: new Date(cur.to + "T00:00:00Z") }, ...(wid ? { warehouseId: wid } : {}) } },
      _sum: { rxCount: true },
    }),
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const stock = new Map(batches.map((b) => [b.itemId, num(b._sum.qty)]));
  const rxMap = new Map(rx.map((r) => [r.itemId, r._sum.rxCount ?? 0]));
  const prevQty = new Map<number, number>();
  for (const r of prevRows) prevQty.set(r.itemId, (prevQty.get(r.itemId) ?? 0) + r.qty);
  const days = Math.max(1, Math.round((parseTaipeiDate(cur.to).getTime() - parseTaipeiDate(cur.from).getTime()) / 86400000) + 1);

  const rows = new Map<number, ItemAnalysisRow>();
  for (const r of curRows) {
    const it = itemMap.get(r.itemId);
    if (!it) continue;
    const row = rows.get(it.id) ?? {
      id: it.id, code: it.code, name: it.name, unit: it.unit, category: it.category?.name ?? "未分類",
      qty: 0, prevQty: prevQty.get(it.id) ?? 0, cost: 0, sale: 0, margin: 0, rx: rxMap.get(it.id) ?? 0,
      share: 0, abc: "C" as const, stock: stock.get(it.id) ?? 0, daysLeft: null,
    };
    const e = earn(r);
    row.qty += r.qty;
    row.cost += r.cost;
    if (!e.free && e.sale != null) { row.sale += e.sale; row.margin += e.sale - r.cost; }
    rows.set(it.id, row);
  }
  // Items used only in the previous period still show (qty 0), so drops are visible.
  for (const [id, q] of prevQty) {
    const it = itemMap.get(id);
    if (!rows.has(id) && it && q > 0) rows.set(id, {
      id, code: it.code, name: it.name, unit: it.unit, category: it.category?.name ?? "未分類",
      qty: 0, prevQty: q, cost: 0, sale: 0, margin: 0, rx: 0, share: 0, abc: "C", stock: stock.get(id) ?? 0, daysLeft: null,
    });
  }
  const list = [...rows.values()];
  const total = list.reduce((s, r) => s + r.cost, 0);
  const abc = abcClass(list);
  for (const r of list) {
    r.share = total ? r.cost / total : 0;
    r.abc = abc.get(r)!;
    const perDay = r.qty / days;
    r.daysLeft = perDay > 0 ? Math.max(0, Math.floor(r.stock / perDay)) : null;
  }
  const count = { A: 0, B: 0, C: 0 };
  const costBy = { A: 0, B: 0, C: 0 };
  for (const r of list) { count[r.abc]++; costBy[r.abc] += r.cost; }
  return { rows: list.sort((a, b) => b.cost - a.cost), total, days, abc: { count, cost: costBy } };
}

// ---------- 庫存健康度 ----------

/** Stock value, how many months it lasts, turnover, slow movers and money tied up in expiring batches. */
export async function inventoryHealth(wid?: number) {
  const settings = await getSettings();
  const since = new Date(Date.now() - settings.usageDays * 86400000);
  const today = new Date();
  const warnUntil = new Date(today.getTime() + settings.expiryWarnDays * 86400000);
  const [items, batches, used, lastMove] = await Promise.all([
    prisma.item.findMany({ where: { active: true }, include: { category: true } }),
    prisma.batch.findMany({ where: { ...(wid ? { warehouseId: wid } : {}), qty: { gt: 0 } } }),
    prisma.stockMovement.groupBy({
      by: ["itemId"],
      where: { type: "CONSUME", date: { gte: since }, ...(wid ? { warehouseId: wid } : {}) },
      _sum: { qty: true },
    }),
    prisma.stockMovement.groupBy({
      by: ["itemId"],
      where: { type: "CONSUME", ...(wid ? { warehouseId: wid } : {}) },
      _max: { date: true },
    }),
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const usedQty = new Map(used.map((u) => [u.itemId, -num(u._sum.qty)]));
  const last = new Map(lastMove.map((m) => [m.itemId, m._max.date]));

  const value = new Map<number, number>();
  const qty = new Map<number, number>();
  let expiringValue = 0, expiredValue = 0;
  const expiring: { id: number; name: string; unit: string; lotNo: string; expiry: Date; qty: number; value: number; monthsToUse: number | null }[] = [];
  for (const b of batches) {
    const q = num(b.qty), v = q * num(b.unitCost);
    value.set(b.itemId, (value.get(b.itemId) ?? 0) + v);
    qty.set(b.itemId, (qty.get(b.itemId) ?? 0) + q);
    if (b.expiryDate && b.expiryDate <= warnUntil) {
      if (b.expiryDate < today) expiredValue += v; else expiringValue += v;
      const it = itemMap.get(b.itemId);
      const monthly = ((usedQty.get(b.itemId) ?? 0) / settings.usageDays) * 30;
      if (it) expiring.push({ id: it.id, name: it.name, unit: it.unit, lotNo: b.lotNo, expiry: b.expiryDate, qty: q, value: v, monthsToUse: monthly > 0 ? q / monthly : null });
    }
  }
  const totalValue = [...value.values()].reduce((s, v) => s + v, 0);
  // Monthly consumption cost over the usage window.
  const costRows = await prisma.stockMovement.findMany({
    where: { type: "CONSUME", date: { gte: since }, ...(wid ? { warehouseId: wid } : {}) },
    select: { qty: true, unitCost: true },
  });
  const monthlyCost = (costRows.reduce((s, m) => s - num(m.qty) * num(m.unitCost), 0) / settings.usageDays) * 30;

  // Slow movers: stock on hand but nothing used in the usage window.
  const slow = [...qty.entries()]
    .filter(([id, q]) => q > 0 && !(usedQty.get(id) ?? 0))
    .map(([id, q]) => {
      const it = itemMap.get(id)!;
      return { id, name: it?.name ?? "", unit: it?.unit ?? "", category: it?.category?.name ?? "", qty: q, value: value.get(id) ?? 0, lastUsed: last.get(id) ?? null };
    })
    .filter((r) => r.name)
    .sort((a, b) => b.value - a.value);

  // Value by category, for the donut.
  const byCat = new Map<string, number>();
  for (const [id, v] of value) {
    const c = itemMap.get(id)?.category?.name ?? "未分類";
    byCat.set(c, (byCat.get(c) ?? 0) + v);
  }

  return {
    usageDays: settings.usageDays,
    warnDays: settings.expiryWarnDays,
    totalValue,
    monthlyCost,
    monthsOnHand: monthlyCost > 0 ? totalValue / monthlyCost : null,
    turnover: totalValue > 0 ? (monthlyCost * 12) / totalValue : null,
    expiringValue,
    expiredValue,
    expiring: expiring.sort((a, b) => a.expiry.getTime() - b.expiry.getTime()),
    slow,
    slowValue: slow.reduce((s, r) => s + r.value, 0),
    categories: [...byCat.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
  };
}
