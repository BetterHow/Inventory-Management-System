import "server-only";
import { prisma } from "./db";
import { num, fmtDate } from "./format";
import { getAccess } from "./auth";
import type { PickItem, PickBatch } from "@/components/LineEditor";

export async function pickItems(): Promise<PickItem[]> {
  const items = await prisma.item.findMany({ where: { active: true, ...(await ownerVisible()) }, orderBy: { code: "asc" } });
  return items.map((i) => ({
    id: i.id,
    code: i.code,
    name: i.name,
    unit: i.unit,
    barcode: i.barcode,
    nhiCode: i.nhiCode,
    keywords: i.keywords,
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

/** Active warehouses this person may see. */
export async function activeWarehouses() {
  const [list, access] = await Promise.all([
    prisma.warehouse.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
    getAccess(),
  ]);
  return list.filter((w) => access.canRead(w.id));
}

/** Active warehouses this person may change: for the 庫別 choice on forms. */
export async function writableWarehouses() {
  const [list, access] = await Promise.all([activeWarehouses(), getAccess()]);
  return list.filter((w) => access.canWrite(w.id));
}

/** For each warehouse, the items it has ever had (stock, movements, settings, orders), so pickers can list just those. */
export async function itemsByWarehouse(): Promise<Record<number, number[]>> {
  const [batches, moves, settings, wanted, lines] = await Promise.all([
    prisma.batch.findMany({ distinct: ["itemId", "warehouseId"], select: { itemId: true, warehouseId: true } }),
    prisma.stockMovement.findMany({ distinct: ["itemId", "warehouseId"], select: { itemId: true, warehouseId: true } }),
    prisma.itemWarehouseSetting.findMany({ select: { itemId: true, warehouseId: true } }),
    prisma.purchaseListEntry.findMany({ distinct: ["itemId", "warehouseId"], select: { itemId: true, warehouseId: true } }),
    prisma.receiptLine.findMany({ distinct: ["itemId", "receiptId"], select: { itemId: true, receipt: { select: { warehouseId: true } } } }),
  ]);
  const sets = new Map<number, Set<number>>();
  const add = (w: number, i: number) => (sets.get(w) ?? sets.set(w, new Set()).get(w)!).add(i);
  for (const r of [...batches, ...moves, ...settings, ...wanted]) add(r.warehouseId, r.itemId);
  for (const l of lines) add(l.receipt.warehouseId, l.itemId);
  return Object.fromEntries([...sets].map(([w, s]) => [w, [...s]]));
}

/** Prisma filter for 品項／供應商: leaves out records owned by a department hidden from this person. */
export async function ownerVisible() {
  const { hidden } = await getAccess();
  return hidden.length ? { OR: [{ ownerWarehouseId: null }, { ownerWarehouseId: { notIn: hidden } }] } : {};
}
