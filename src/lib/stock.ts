import { Prisma, type MovementType } from "@prisma/client";
import { allocateFefo, round2 } from "./logic";
import { num } from "./format";

type Tx = Prisma.TransactionClient;

type Common = {
  itemId: number;
  warehouseId: number;
  date: Date;
  type: MovementType;
  refType?: string;
  refId?: number;
  note?: string | null;
  userId?: number | null;
  source?: string;
};

/** Add stock into a batch (same lot + expiry + cost is merged) and write a movement. */
export async function addStock(
  tx: Tx,
  a: Common & { qty: number; unitCost: number; lotNo?: string; expiryDate?: Date | null },
) {
  const lotNo = (a.lotNo ?? "").trim();
  const expiryDate = a.expiryDate ?? null;
  let batch = await tx.batch.findFirst({
    where: { itemId: a.itemId, warehouseId: a.warehouseId, lotNo, expiryDate, unitCost: a.unitCost },
  });
  if (batch) {
    batch = await tx.batch.update({ where: { id: batch.id }, data: { qty: { increment: a.qty } } });
  } else {
    batch = await tx.batch.create({
      data: { itemId: a.itemId, warehouseId: a.warehouseId, lotNo, expiryDate, unitCost: a.unitCost, qty: a.qty },
    });
  }
  await tx.stockMovement.create({
    data: {
      date: a.date,
      itemId: a.itemId,
      warehouseId: a.warehouseId,
      batchId: batch.id,
      type: a.type,
      qty: a.qty,
      unitCost: a.unitCost,
      source: a.source ?? "MANUAL",
      refType: a.refType,
      refId: a.refId,
      note: a.note ?? undefined,
      userId: a.userId ?? undefined,
    },
  });
  return batch;
}

/**
 * Take stock out, first-expiring batch first (or from one chosen batch).
 * Negative stock is allowed; the returned `shortfall` tells the caller to warn the user.
 */
export async function removeStock(tx: Tx, a: Common & { qty: number; batchId?: number | null }) {
  const qty = round2(a.qty);
  let allocations: { batchId: number | null; qty: number }[];
  let shortfall = 0;
  if (a.batchId) {
    const b = await tx.batch.findUniqueOrThrow({ where: { id: a.batchId } });
    if (b.itemId !== a.itemId || b.warehouseId !== a.warehouseId) throw new Error("批號與品項或庫別不符");
    shortfall = Math.max(0, round2(qty - num(b.qty)));
    allocations = [{ batchId: b.id, qty }];
  } else {
    const batches = await tx.batch.findMany({ where: { itemId: a.itemId, warehouseId: a.warehouseId } });
    const r = allocateFefo(
      batches.map((b) => ({ id: b.id, qty: num(b.qty), expiryDate: b.expiryDate, createdAt: b.createdAt })),
      qty,
    );
    allocations = r.allocations;
    shortfall = r.shortfall;
  }

  const moved: { batchId: number; qty: number; unitCost: number }[] = [];
  for (const al of allocations) {
    let batchId = al.batchId;
    let unitCost = 0;
    if (batchId === null) {
      // No batch at all yet: create an empty one at the reference price so cost reports still work.
      const item = await tx.item.findUniqueOrThrow({ where: { id: a.itemId } });
      unitCost = num(item.refPrice);
      const b = await tx.batch.create({
        data: { itemId: a.itemId, warehouseId: a.warehouseId, unitCost, qty: 0 },
      });
      batchId = b.id;
    }
    const b = await tx.batch.update({ where: { id: batchId }, data: { qty: { decrement: al.qty } } });
    unitCost = num(b.unitCost);
    await tx.stockMovement.create({
      data: {
        date: a.date,
        itemId: a.itemId,
        warehouseId: a.warehouseId,
        batchId,
        type: a.type,
        qty: -al.qty,
        unitCost,
        source: a.source ?? "MANUAL",
        refType: a.refType,
        refId: a.refId,
        note: a.note ?? undefined,
        userId: a.userId ?? undefined,
      },
    });
    moved.push({ batchId, qty: al.qty, unitCost });
  }
  return { moved, shortfall };
}

/** Current quantity per item in one warehouse (or all), from batch balances. */
export async function stockByItem(tx: Tx | Prisma.DefaultPrismaClient, warehouseId?: number) {
  const rows = await tx.batch.groupBy({
    by: ["itemId"],
    where: warehouseId ? { warehouseId } : undefined,
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.itemId, num(r._sum.qty)]));
}

/** Consumption per item over the last `days` days, for automatic safety stock. */
export async function usageByItem(tx: Tx | Prisma.DefaultPrismaClient, days: number, warehouseId?: number) {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await tx.stockMovement.groupBy({
    by: ["itemId"],
    where: { type: "CONSUME", date: { gte: since }, ...(warehouseId ? { warehouseId } : {}) },
    _sum: { qty: true },
  });
  return new Map(rows.map((r) => [r.itemId, -num(r._sum.qty)]));
}

/** Next document number like R20261106-001. */
export async function nextNumber(
  tx: Tx,
  prefix: string,
  model: "receipt" | "transfer" | "stocktake",
  dateStr: string,
) {
  const base = `${prefix}${dateStr.replaceAll("-", "")}-`;
  const where = { number: { startsWith: base } };
  const count =
    model === "receipt"
      ? await tx.receipt.count({ where })
      : model === "transfer"
        ? await tx.transfer.count({ where })
        : await tx.stocktake.count({ where });
  return `${base}${String(count + 1).padStart(3, "0")}`;
}
