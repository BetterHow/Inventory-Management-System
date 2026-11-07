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
export type MonthRow = { key: string; label: string; cost: number; sale: number; margin: number; net: number; received: number };

const end = (to: string) => new Date(parseTaipeiDate(to).getTime() + 86400000 - 1);

async function consumption(from: string, to: string, wid?: number) {
  const moves = await prisma.stockMovement.findMany({
    where: { type: "CONSUME", date: { gte: parseTaipeiDate(from), lte: end(to) }, ...(wid ? { warehouseId: wid } : {}) },
    select: { date: true, qty: true, unitCost: true, itemId: true, refType: true, refId: true },
  });
  const ids = [...new Set(moves.filter((m) => m.refType === "CONSUMPTION" && m.refId).map((m) => m.refId!))];
  const notes = new Map(
    (await prisma.consumption.findMany({ where: { id: { in: ids } }, select: { id: true, note: true } })).map((c) => [c.id, c.note]),
  );
  return moves.map((m) => {
    const note = m.refType === "CONSUMPTION" && m.refId ? notes.get(m.refId) ?? null : null;
    return { date: m.date, itemId: m.itemId, qty: -num(m.qty), cost: -num(m.qty) * num(m.unitCost), note };
  });
}

async function receivedTotal(from: string, to: string, wid?: number) {
  const r = await prisma.receipt.aggregate({
    where: { status: "RECEIVED", date: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T00:00:00Z") }, ...(wid ? { warehouseId: wid } : {}) },
    _sum: { totalAmount: true },
  });
  return num(r._sum.totalAmount);
}

export async function analytics(cur: Period, prev: Period, wid?: number) {
  const [items, priceAt, { words, test: noRevenue }] = await Promise.all([
    prisma.item.findMany({ include: { category: true } }),
    priceLookup(),
    noRevenueTest(),
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));

  function summarize(rows: Awaited<ReturnType<typeof consumption>>, received: number): Totals {
    const t: Totals = { cost: 0, sale: 0, margin: 0, net: 0, pricedCost: 0, noRevenueCost: 0, received };
    for (const r of rows) {
      t.cost += r.cost;
      const price = priceAt(r.itemId, r.date);
      if (noRevenue(r.note)) t.noRevenueCost += r.cost;
      else if (price != null) {
        t.sale += r.qty * price;
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
  for (const r of curRows) {
    const it = itemMap.get(r.itemId);
    if (!it) continue;
    const price = priceAt(it.id, r.date);
    const priced = price != null;
    const earns = priced && !noRevenue(r.note);
    const sale = earns ? r.qty * price : 0;
    const margin = earns ? sale - r.cost : 0;
    const row = byItem.get(it.id) ?? { id: it.id, code: it.code, name: it.name, unit: it.unit, qty: 0, cost: 0, sale: 0, margin: 0, priced };
    row.qty += r.qty; row.cost += r.cost; row.sale += sale; row.margin += margin;
    byItem.set(it.id, row);
    const cname = it.category?.name ?? "未分類";
    const c = byCat.get(cname) ?? { name: cname, cost: 0, sale: 0, margin: 0 };
    c.cost += r.cost; c.sale += sale; c.margin += margin;
    byCat.set(cname, c);
    const pname = r.note?.trim() || "（未填用途）";
    const p = byPurpose.get(pname) ?? { name: pname, cost: 0, sale: 0, margin: 0, revenue: !noRevenue(r.note) };
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
    const price = priceAt(r.itemId, r.date);
    if (noRevenue(r.note)) m.net -= r.cost;
    else if (price != null) {
      m.sale += r.qty * price;
      m.margin += r.qty * price - r.cost;
      m.net += r.qty * price - r.cost;
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
    topCost: [...itemRows].sort((a, b) => b.cost - a.cost).slice(0, 10),
    topMargin: itemRows.filter((r) => r.priced && r.sale > 0).sort((a, b) => b.margin - a.margin).slice(0, 10),
    unpriced: itemRows.filter((r) => !r.priced).sort((a, b) => b.cost - a.cost),
  };
}

/** 價差 for one period (used on the dashboard). */
export async function periodMargin(from: string, to: string, wid?: number) {
  const [rows, priceAt, { test: noRevenue }] = await Promise.all([consumption(from, to, wid), priceLookup(), noRevenueTest()]);
  let sale = 0, cost = 0;
  for (const r of rows) {
    const p = priceAt(r.itemId, r.date);
    if (p === null || noRevenue(r.note)) continue;
    sale += r.qty * p;
    cost += r.cost;
  }
  return { sale, margin: sale - cost };
}
