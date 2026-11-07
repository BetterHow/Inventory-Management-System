import "server-only";
import { prisma } from "./db";
import { num } from "./format";
import { expiryStatus, monthlyFromTotal, round2, safetyStatus, type ExpiryStatus, type SafetyStatus } from "./logic";
import { getSettings } from "./settings";

export type OverviewRow = {
  itemId: number;
  code: string;
  name: string;
  unit: string;
  category: string;
  stock: number;
  value: number; // 庫存金額（依批號成本）
  monthlyUsage: number | null;
  manual: boolean;
  status: SafetyStatus;
  nearestExpiry: Date | null;
  expiry: ExpiryStatus;
  defaultSupplierId: number | null;
  inWarehouse: boolean; // 這個庫別有用過（有庫存、異動或安全量設定）；看全部庫別時一律為 true
};

/**
 * One row per active item: stock, value, monthly usage and safety status,
 * for one warehouse or for all of them added together.
 */
export async function stockOverview(warehouseId?: number): Promise<OverviewRow[]> {
  const settings = await getSettings();
  const since = new Date(Date.now() - settings.usageDays * 86400000);
  const whereWh = warehouseId ? { warehouseId } : {};
  const [items, batches, usage, manual, moved, configured] = await Promise.all([
    prisma.item.findMany({ where: { active: true }, include: { category: true }, orderBy: { code: "asc" } }),
    prisma.batch.findMany({ where: whereWh }),
    prisma.stockMovement.groupBy({
      by: ["itemId", "warehouseId"],
      where: { type: "CONSUME", date: { gte: since }, ...whereWh },
      _sum: { qty: true },
    }),
    prisma.itemWarehouseSetting.findMany({ where: { manualMonthlyUsage: { not: null }, ...whereWh } }),
    warehouseId ? prisma.stockMovement.findMany({ where: { warehouseId }, distinct: ["itemId"], select: { itemId: true } }) : [],
    warehouseId ? prisma.itemWarehouseSetting.findMany({ where: { warehouseId }, select: { itemId: true } }) : [],
  ]);
  const used = new Set<number>([...batches.map((b) => b.itemId), ...moved.map((m) => m.itemId), ...configured.map((c) => c.itemId)]);

  const stock = new Map<number, number>();
  const value = new Map<number, number>();
  const nearest = new Map<number, Date>();
  for (const b of batches) {
    const q = num(b.qty);
    stock.set(b.itemId, (stock.get(b.itemId) ?? 0) + q);
    value.set(b.itemId, (value.get(b.itemId) ?? 0) + q * num(b.unitCost));
    if (q > 0 && b.expiryDate) {
      const cur = nearest.get(b.itemId);
      if (!cur || b.expiryDate < cur) nearest.set(b.itemId, b.expiryDate);
    }
  }

  // Monthly usage per item+warehouse: manual setting wins, else automatic.
  const monthly = new Map<string, number>();
  for (const u of usage) monthly.set(`${u.itemId}:${u.warehouseId}`, monthlyFromTotal(-num(u._sum.qty), settings.usageDays));
  const manualKeys = new Set<string>();
  for (const m of manual) {
    const k = `${m.itemId}:${m.warehouseId}`;
    monthly.set(k, num(m.manualMonthlyUsage));
    manualKeys.add(k);
  }
  const usageByItem = new Map<number, number>();
  const manualItem = new Set<number>();
  for (const [k, v] of monthly) {
    const itemId = Number(k.split(":")[0]);
    usageByItem.set(itemId, (usageByItem.get(itemId) ?? 0) + v);
    if (manualKeys.has(k)) manualItem.add(itemId);
  }

  const today = new Date();
  return items.map((i) => {
    const s = round2(stock.get(i.id) ?? 0);
    const mu = usageByItem.has(i.id) ? round2(usageByItem.get(i.id)!) : null;
    const ne = nearest.get(i.id) ?? null;
    return {
      itemId: i.id,
      code: i.code,
      name: i.name,
      unit: i.unit,
      category: i.category?.name ?? "",
      stock: s,
      value: round2(value.get(i.id) ?? 0),
      monthlyUsage: mu,
      manual: manualItem.has(i.id),
      status: safetyStatus(s, mu),
      nearestExpiry: ne,
      expiry: expiryStatus(ne, today, settings.expiryWarnDays, settings.expiryDangerDays),
      defaultSupplierId: i.defaultSupplierId,
      inWarehouse: !warehouseId || used.has(i.id),
    };
  });
}
