import "server-only";
import { prisma } from "./db";
import { num } from "./format";
import { stockOverview } from "./overview";

export type Suggestion = {
  warehouseId: number; itemId: number; code: string; name: string; unit: string;
  stock: number; onOrder: number; monthlyUsage: number; suggest: number; status: string; supplierId: number | null;
};

/**
 * Items under 1 month of stock (or negative), with the quantity that brings them back to
 * `targetMonths` of usage, minus what is already on the list or ordered and not yet received.
 */
export async function reorderSuggestions(warehouseIds: number[], targetMonths = 3): Promise<Suggestion[]> {
  const [pending, ordered] = await Promise.all([
    prisma.purchaseListEntry.groupBy({ by: ["itemId", "warehouseId"], where: { status: "PENDING", warehouseId: { in: warehouseIds } }, _sum: { qty: true } }),
    prisma.receiptLine.findMany({
      where: { receipt: { status: { in: ["ORDERED", "PENDING_INSPECTION"] }, warehouseId: { in: warehouseIds } } },
      select: { itemId: true, qty: true, freeQty: true, receipt: { select: { warehouseId: true } } },
    }),
  ]);
  const onOrder = new Map<string, number>();
  const add = (k: string, q: number) => onOrder.set(k, (onOrder.get(k) ?? 0) + q);
  for (const p of pending) add(`${p.warehouseId}:${p.itemId}`, num(p._sum.qty));
  for (const l of ordered) add(`${l.receipt.warehouseId}:${l.itemId}`, num(l.qty) + num(l.freeQty));

  const out: Suggestion[] = [];
  for (const wid of warehouseIds) {
    const rows = await stockOverview(wid);
    for (const r of rows) {
      if (!r.inWarehouse || (r.status !== "NEGATIVE" && r.status !== "LT1")) continue;
      const mu = r.monthlyUsage ?? 0;
      const oo = onOrder.get(`${wid}:${r.itemId}`) ?? 0;
      const suggest = Math.ceil(mu * targetMonths - r.stock - oo);
      if (suggest <= 0) continue;
      out.push({ warehouseId: wid, itemId: r.itemId, code: r.code, name: r.name, unit: r.unit, stock: r.stock, onOrder: oo, monthlyUsage: mu, suggest, status: r.status, supplierId: r.defaultSupplierId });
    }
  }
  return out.sort((a, b) => a.stock / (a.monthlyUsage || 1) - b.stock / (b.monthlyUsage || 1));
}
