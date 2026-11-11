import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { getAccess } from "./auth";
import { num } from "./format";
import { movementTime, round2 } from "./logic";
import { removeStock } from "./stock";
import { classifyRows, type HisRow, type PriceType } from "./hisParse";

export type PreviewRow = HisRow & {
  key: number;
  itemId: number | null;
  matchedBy: "map" | "nhi" | "code" | "barcode" | null;
  factor: number;
  priceType: PriceType;
  guessed: boolean; // 系統還沒有健保價，用最低價推估為健保
  nhiPrice: number | null;
};

type PriceInfo = { nhiPrice: Prisma.Decimal | null; salePrice: Prisma.Decimal | null; priceSource: string };

/** 健保價: the imported 健保署 price, or the item's own price when it follows 健保. */
function nhiOf(i: PriceInfo): number | null {
  if (i.nhiPrice != null) return num(i.nhiPrice);
  if (i.priceSource === "NHI" && i.salePrice != null) return num(i.salePrice);
  return null;
}

/** Matches each report row to an item: remembered mapping, then 健保碼, 料號, 條碼. Nothing is saved. */
export async function previewHis(rows: HisRow[], warehouseId: number, from: string, to: string) {
  const canSee = (await getAccess()).canRead;
  const [items, maps, overlap] = await Promise.all([
    prisma.item.findMany({ where: { active: true }, select: { id: true, code: true, name: true, unit: true, nhiCode: true, barcode: true, keywords: true, ownerWarehouseId: true, nhiPrice: true, salePrice: true, priceSource: true } }),
    prisma.hisCodeMap.findMany(),
    prisma.hisImport.findMany({
      where: { warehouseId, dateFrom: { lte: new Date(to + "T00:00:00Z") }, dateTo: { gte: new Date(from + "T00:00:00Z") } },
      select: { id: true, dateFrom: true, dateTo: true, createdAt: true, rowCount: true },
    }),
  ]);
  const byId = new Map(items.map((i) => [i.id, i]));
  const mapBy = new Map(maps.map((m) => [m.hisCode, m]));
  const up = (s: string | null) => s?.trim().toUpperCase() || null;
  const byNhi = new Map(items.filter((i) => i.nhiCode).map((i) => [up(i.nhiCode)!, i]));
  const byCode = new Map(items.map((i) => [up(i.code)!, i]));
  const byBarcode = new Map(items.filter((i) => i.barcode).map((i) => [up(i.barcode)!, i]));

  const matched = rows.map((r, key) => {
    const m = mapBy.get(r.code);
    let item = m ? byId.get(m.itemId) : undefined;
    let matchedBy: PreviewRow["matchedBy"] = item ? "map" : null;
    if (!item && (item = byNhi.get(r.code))) matchedBy = "nhi";
    if (!item && (item = byCode.get(r.code))) matchedBy = "code";
    if (!item && (item = byBarcode.get(r.code))) matchedBy = "barcode";
    return { ...r, key, item, itemId: item?.id ?? null, matchedBy, factor: m ? num(m.factor) : 1, nhiPrice: item ? nhiOf(item) : null };
  });
  const byRowCode = new Map(matched.map((r) => [r.code, r.item]));
  const out: PreviewRow[] = classifyRows(matched, (code) => {
    const it = byRowCode.get(code);
    return it ? { nhiPrice: nhiOf(it), hasNhiCode: Boolean(it.nhiCode) } : null;
  }).map(({ item: _item, ...r }) => r);
  return {
    rows: out,
    // The item list to pick from leaves out other departments' own items; automatic matching above still sees every item.
    items: items
      .filter((i) => i.ownerWarehouseId == null || canSee(i.ownerWarehouseId))
      .map((i) => ({ id: i.id, code: i.code, name: i.name, unit: i.unit, nhiCode: i.nhiCode, keywords: i.keywords }))
      .sort((a, b) => a.code.localeCompare(b.code)),
    overlap: overlap.map((o) => ({ id: o.id, from: o.dateFrom.toISOString().slice(0, 10), to: o.dateTo.toISOString().slice(0, 10), at: o.createdAt, rows: o.rowCount })),
  };
}

export type ApplyRow = HisRow & { itemId: number | null; factor: number };

/**
 * Deducts stock (first-expiring batch first), records the report's 合計 as revenue on each movement,
 * remembers code → item mappings, and keeps the import so it can be undone.
 */
export async function applyHis(a: { rows: ApplyRow[]; warehouseId: number; from: string; to: string; fileName: string | null; userId: number }) {
  const rows = a.rows.filter((r) => r.itemId && r.qty);
  const skipped = a.rows.length - rows.length;
  const warnings: string[] = [];
  const date = movementTime(a.to);
  const items = new Map(
    (await prisma.item.findMany({ where: { id: { in: rows.map((r) => r.itemId!) } }, select: { id: true, name: true, nhiCode: true, nhiPrice: true, salePrice: true, priceSource: true } })).map((i) => [i.id, i]),
  );
  const codeItem = new Map(rows.map((r) => [r.code, items.get(r.itemId!)]));
  const typed = classifyRows(rows, (code) => {
    const it = codeItem.get(code);
    return it ? { nhiPrice: nhiOf(it), hasNhiCode: Boolean(it.nhiCode) } : null;
  });
  const imp = await prisma.$transaction(async (tx) => {
    const imp = await tx.hisImport.create({
      data: {
        dateFrom: new Date(a.from + "T00:00:00Z"),
        dateTo: new Date(a.to + "T00:00:00Z"),
        warehouseId: a.warehouseId,
        fileName: a.fileName,
        rowCount: rows.length,
        createdById: a.userId,
      },
    });
    let qtySum = 0, revenueSum = 0, costSum = 0;
    for (const r of typed) {
      const it = items.get(r.itemId!);
      if (!it) continue;
      const priceType = r.priceType;
      const factor = r.factor > 0 ? r.factor : 1;
      const qty = round2(r.qty * factor);
      const res = await removeStock(tx, {
        itemId: it.id,
        warehouseId: a.warehouseId,
        qty,
        date,
        type: "CONSUME",
        source: "HIS",
        refType: "HIS_IMPORT",
        refId: imp.id,
        note: "HIS 匯入",
        userId: a.userId,
        revenue: r.amount,
        priceType,
      });
      const cost = round2(res.moved.reduce((s, m) => s + m.qty * m.unitCost, 0));
      if (res.shortfall > 0) warnings.push(`${it.name} 庫存不足 ${res.shortfall}`);
      await tx.hisImportLine.create({
        data: {
          importId: imp.id, hisCode: r.code, hisName: r.name, itemId: it.id, unitPrice: r.price, hisQty: r.qty, qty,
          amount: r.amount, hisCost: r.hisCost, rxCount: r.rx, priceType, cost,
        },
      });
      await tx.hisCodeMap.upsert({ where: { hisCode: r.code }, create: { hisCode: r.code, itemId: it.id, factor }, update: { itemId: it.id, factor } });
      qtySum += qty; revenueSum += r.amount; costSum += cost;
    }
    return tx.hisImport.update({ where: { id: imp.id }, data: { qty: round2(qtySum), revenue: round2(revenueSum), cost: round2(costSum) } });
  }, { timeout: 120000 });
  return { importId: imp.id, count: rows.length, skipped, warnings };
}

/** Puts the stock back and removes everything one import wrote. */
export async function undoHis(id: number) {
  await prisma.$transaction(async (tx) => {
    const moves = await tx.stockMovement.findMany({ where: { refType: "HIS_IMPORT", refId: id } });
    for (const m of moves) {
      if (m.batchId) await tx.batch.update({ where: { id: m.batchId }, data: { qty: { increment: -num(m.qty) } } });
    }
    await tx.stockMovement.deleteMany({ where: { refType: "HIS_IMPORT", refId: id } });
    await tx.hisImport.delete({ where: { id } });
  }, { timeout: 120000 });
}
