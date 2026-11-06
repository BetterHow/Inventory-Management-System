import "server-only";
import { prisma } from "./db";
import { num, fmtDate } from "./format";
import type { PickItem, PickBatch } from "@/components/LineEditor";

export async function pickItems(): Promise<PickItem[]> {
  const items = await prisma.item.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  return items.map((i) => ({
    id: i.id,
    code: i.code,
    name: i.name,
    unit: i.unit,
    barcode: i.barcode,
    nhiCode: i.nhiCode,
    refPrice: num(i.refPrice),
    trackBatch: i.trackBatch,
  }));
}

/** Batches with stock left, plus total stock per warehouse+item, for the line editor. */
export async function pickStock(): Promise<{ batches: PickBatch[]; stock: Record<string, number> }> {
  const batches = await prisma.batch.findMany({ orderBy: [{ expiryDate: "asc" }, { id: "asc" }] });
  const stock: Record<string, number> = {};
  for (const b of batches) {
    const k = `${b.warehouseId}:${b.itemId}`;
    stock[k] = Math.round(((stock[k] ?? 0) + num(b.qty)) * 100) / 100;
  }
  return {
    batches: batches
      .filter((b) => num(b.qty) > 0)
      .map((b) => ({
        id: b.id,
        itemId: b.itemId,
        warehouseId: b.warehouseId,
        lotNo: b.lotNo,
        expiry: fmtDate(b.expiryDate, true),
        qty: num(b.qty),
      })),
    stock,
  };
}

export async function activeWarehouses() {
  return prisma.warehouse.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
}
