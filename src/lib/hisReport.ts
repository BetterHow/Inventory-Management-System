// Totals for the HIS 耗用分析 page. Plain functions with no database access, so they can be unit tested.
import type { PriceType } from "./hisParse";

export type ReportLine = {
  itemId: number | null;
  hisCode: string;
  hisName: string;
  priceType: PriceType;
  unitPrice: number;
  hisQty: number; // 報表用量（HIS 單位）
  qty: number; // 扣庫數量（庫存單位）
  amount: number; // 收入（報表合計）
  cost: number; // 依進貨批次算的成本
  hisCost: number | null; // 方鼎的單位成本（HIS 單位）
};

type Money = { revenue: number; cost: number; margin: number };
export type TypeRow = Money & { type: PriceType; qty: number; lines: number };
export type ItemReportRow = Money & {
  key: string;
  itemId: number | null;
  hisCode: string;
  hisName: string;
  qty: number;
  hisCostTotal: number | null; // 方鼎成本合計；有任何一列沒有成本就是 null
  prices: { type: PriceType; price: number }[];
  flags: ("NO_COST" | "HIS_NO_COST" | "COST_DIFF" | "LOSS")[];
};

/** How far apart our cost and 方鼎's cost may be before the row is flagged. */
export const COST_DIFF_LIMIT = 0.2;

export function summarizeHis(lines: ReportLine[]) {
  const totals: Money & { hisCost: number } = { revenue: 0, cost: 0, margin: 0, hisCost: 0 };
  const types = new Map<PriceType, TypeRow>(
    (["NHI", "SELF", "FREE"] as PriceType[]).map((t) => [t, { type: t, qty: 0, lines: 0, revenue: 0, cost: 0, margin: 0 }]),
  );
  const items = new Map<string, ItemReportRow & { missingHisCost: boolean }>();

  for (const l of lines) {
    totals.revenue += l.amount;
    totals.cost += l.cost;
    if (l.hisCost != null) totals.hisCost += l.hisCost * l.hisQty;
    const t = types.get(l.priceType)!;
    t.qty += l.qty; t.lines += 1; t.revenue += l.amount; t.cost += l.cost;

    const key = l.itemId != null ? `i${l.itemId}` : `c${l.hisCode}`;
    const row = items.get(key) ?? {
      key, itemId: l.itemId, hisCode: l.hisCode, hisName: l.hisName, qty: 0, revenue: 0, cost: 0, margin: 0,
      hisCostTotal: 0, missingHisCost: false, prices: [], flags: [],
    };
    row.qty += l.qty; row.revenue += l.amount; row.cost += l.cost;
    if (l.hisCost == null) row.missingHisCost = true;
    else row.hisCostTotal = (row.hisCostTotal ?? 0) + l.hisCost * l.hisQty;
    if (!row.prices.some((p) => p.type === l.priceType && Math.abs(p.price - l.unitPrice) < 0.005)) {
      row.prices.push({ type: l.priceType, price: l.unitPrice });
    }
    items.set(key, row);
  }

  totals.margin = totals.revenue - totals.cost;
  for (const t of types.values()) t.margin = t.revenue - t.cost;

  const itemRows: ItemReportRow[] = [...items.values()].map(({ missingHisCost, ...r }) => {
    r.margin = r.revenue - r.cost;
    r.hisCostTotal = missingHisCost ? null : r.hisCostTotal;
    r.prices.sort((a, b) => b.price - a.price);
    if (r.qty > 0 && Math.abs(r.cost) < 0.005) r.flags.push("NO_COST");
    if (r.hisCostTotal != null && r.qty > 0 && Math.abs(r.hisCostTotal) < 0.005) r.flags.push("HIS_NO_COST");
    if (r.hisCostTotal && r.cost && Math.abs(r.cost - r.hisCostTotal) / r.hisCostTotal > COST_DIFF_LIMIT) r.flags.push("COST_DIFF");
    if (r.revenue > 0 && r.margin < 0) r.flags.push("LOSS");
    return r;
  });
  itemRows.sort((a, b) => b.revenue - a.revenue || b.cost - a.cost);

  return { totals, types: [...types.values()], items: itemRows };
}
