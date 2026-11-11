import "server-only";
import ExcelJS from "exceljs";
import type { Prisma, PriceSource } from "@prisma/client";
import { prisma } from "./db";
import { num } from "./format";
import { todayTaipei } from "./logic";

type Tx = Prisma.TransactionClient;

/** Sets an item's current 健保價／售價 and keeps the history used by 統計分析. */
export async function setItemPrice(tx: Tx, itemId: number, price: number | null, source: PriceSource, from = todayTaipei()) {
  const item = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
  const old = item.salePrice == null ? null : num(item.salePrice);
  if (old === price) return false;
  await tx.item.update({ where: { id: itemId }, data: { salePrice: price } });
  if (price != null) {
    const hasHistory = await tx.itemPrice.count({ where: { itemId } });
    // The first price ever set also covers earlier consumption, so past periods aren't left at 0.
    const effectiveFrom = new Date((hasHistory ? from : "2000-01-01") + "T00:00:00Z");
    await tx.itemPrice.deleteMany({ where: { itemId, effectiveFrom } });
    await tx.itemPrice.create({ data: { itemId, price, effectiveFrom, source } });
  }
  return true;
}

/** Looks up the price in force on a date, from each item's history. */
export async function priceLookup() {
  const rows = await prisma.itemPrice.findMany({ orderBy: [{ itemId: "asc" }, { effectiveFrom: "asc" }] });
  const byItem = new Map<number, { from: number; price: number }[]>();
  for (const r of rows) {
    const list = byItem.get(r.itemId) ?? [];
    list.push({ from: r.effectiveFrom.getTime(), price: num(r.price) });
    byItem.set(r.itemId, list);
  }
  return (itemId: number, date: Date): number | null => {
    const list = byItem.get(itemId);
    if (!list?.length) return null;
    // compare by calendar day in Taiwan time
    const t = Date.UTC(...(ymdParts(date) as [number, number, number]));
    let price = list[0].price;
    for (const p of list) if (p.from <= t) price = p.price;
    return price;
  };
}

function ymdParts(d: Date) {
  const t = new Date(d.getTime() + 8 * 3600000);
  return [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
}

// ---------- 健保價格檔 ----------
import { parseNhiTable, decodeText, textToTable, type NhiRow } from "./nhiParse";
export type { NhiRow };

/** Reads a 健保署 price file on the server (used when updating from a web address). */
export async function parseNhiFile(buf: Buffer, filename: string): Promise<{ rows: NhiRow[]; error?: string }> {
  if (/\.xlsx$/i.test(filename) || buf.subarray(0, 2).toString() === "PK") {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buf as unknown as ArrayBuffer);
    } catch {
      return { rows: [], error: "檔案看起來是壓縮檔（zip），請先解壓縮，或改用 CSV／TXT／Excel 的網址。" };
    }
    const rows: string[][] = [];
    wb.worksheets[0].eachRow((row) => rows.push((row.values as unknown[]).slice(1).map(cellText)));
    return parseNhiTable(rows);
  }
  return parseNhiTable(textToTable(decodeText(new Uint8Array(buf))));
}

function cellText(v: unknown): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (v && typeof v === "object" && "result" in v) return String((v as { result: unknown }).result);
  if (v && typeof v === "object" && "richText" in v) return (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
  return String(v ?? "");
}

export type PriceChange = { itemId: number; code: string; name: string; nhiCode: string; source: PriceSource; old: number | null; price: number; from: string | null };

/** Matches the file to items by 健保碼 and works out what would change. Nothing is saved here. */
export async function previewNhiPrices(rows: NhiRow[]) {
  const today = todayTaipei();
  // A code can appear several times (old and new prices): use the one in force today, else the newest.
  const best = new Map<string, NhiRow>();
  for (const r of rows) {
    const cur = best.get(r.code);
    const valid = (x: NhiRow) => (!x.from || x.from <= today) && (!x.to || x.to >= today);
    if (!cur || (valid(r) && !valid(cur)) || (valid(r) === valid(cur) && (r.from ?? "") > (cur.from ?? ""))) best.set(r.code, r);
  }
  const items = await prisma.item.findMany({ where: { active: true }, orderBy: { code: "asc" } });
  const changes: PriceChange[] = [];
  const same: PriceChange[] = [];
  const notFound: { id: number; code: string; name: string; nhiCode: string | null; source: PriceSource }[] = [];
  for (const it of items) {
    const key = it.nhiCode?.trim().toUpperCase();
    const hit = key ? best.get(key) : undefined;
    if (!hit) {
      notFound.push({ id: it.id, code: it.code, name: it.name, nhiCode: it.nhiCode, source: it.priceSource });
      continue;
    }
    const current = it.priceSource === "NHI" ? (it.salePrice == null ? null : num(it.salePrice)) : (it.nhiPrice == null ? null : num(it.nhiPrice));
    const c = { itemId: it.id, code: it.code, name: it.name, nhiCode: it.nhiCode!, source: it.priceSource, old: current, price: hit.price, from: hit.from };
    (current === hit.price ? same : changes).push(c);
  }
  return { fileRows: rows.length, codes: best.size, changes, same, notFound };
}

/** Saves the 健保價 for matched items; items set to follow 健保價 also get it as their price. */
export async function applyNhiPrices(list: { itemId: number; price: number; from: string | null }[]) {
  const now = new Date();
  let updated = 0;
  await prisma.$transaction(async (tx) => {
    for (const c of list) {
      const it = await tx.item.update({
        where: { id: c.itemId },
        data: { nhiPrice: c.price, nhiPriceFrom: c.from ? new Date(c.from + "T00:00:00Z") : null, nhiCheckedAt: now },
      });
      if (it.priceSource === "NHI" && (await setItemPrice(tx, it.id, c.price, "NHI", c.from && c.from <= todayTaipei() ? c.from : todayTaipei()))) updated++;
    }
  }, { timeout: 60000 });
  return updated;
}
