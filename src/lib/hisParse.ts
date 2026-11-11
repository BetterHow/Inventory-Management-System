// Reading the HIS (方鼎) daily drug usage report 「藥品耗用統計表」.
// Plain functions with no database access: used in the browser and in unit tests.

export type HisRow = {
  code: string; // 藥品代號（多半是健保碼）
  name: string; // 藥品簡稱
  price: number; // 單價
  qty: number; // 用量
  amount: number; // 合計（HIS 已四捨五入，當作收入）
  hisCost: number | null; // 成本（HIS 的參考成本）
  rx: number | null; // 開藥次
};

export type HisParse = { rows: HisRow[]; from: string | null; to: string | null; error?: string };

const CODE = ["藥品代號", "藥品代碼", "藥代", "代號", "代碼", "健保碼"];
const NAME = ["藥品簡稱", "藥品名稱", "簡稱", "品名", "名稱"];
const PRICE = ["單價", "價格"];
const QTY = ["用量", "數量", "總量"];
const AMOUNT = ["合計", "金額", "小計"];
const COST = ["成本", "單位成本"];
const RX = ["開藥次", "開藥次數", "次數"];

const toNum = (v: unknown) => {
  const s = String(v ?? "").replace(/[,\s]/g, "");
  if (!s) return NaN;
  return Number(s);
};

/** "115 年 11 月 9 日" (民國) or "2026/11/09" → "2026-11-09". Returns every date found, in order. */
export function findDates(text: string): string[] {
  const out: string[] = [];
  const re = /(\d{2,4})\s*[年\/\-.]\s*(\d{1,2})\s*[月\/\-.]\s*(\d{1,2})\s*日?/g;
  for (const m of text.matchAll(re)) {
    let y = Number(m[1]);
    const mo = Number(m[2]), d = Number(m[3]);
    if (y < 1000) y += 1911;
    if (mo < 1 || mo > 12 || d < 1 || d > 31) continue;
    out.push(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

/** The report period, from the 「統計期間」 line (or the first two dates in the file). */
export function findPeriod(text: string): { from: string | null; to: string | null } {
  const line = text.split(/\r?\n/).find((l) => /統計期間|期間|日期/.test(l)) ?? text.slice(0, 2000);
  const dates = findDates(line);
  return { from: dates[0] ?? null, to: dates[1] ?? dates[0] ?? null };
}

/** Rows of cells (from CSV or Excel). Columns are found by their header names. */
export function parseHisTable(table: string[][], periodText = ""): HisParse {
  const norm = (c: string) => String(c ?? "").replace(/\s/g, "");
  const headerIdx = table.findIndex((r) => r.some((c) => CODE.includes(norm(c))) && r.some((c) => QTY.includes(norm(c))));
  const period = findPeriod(periodText || table.slice(0, 6).map((r) => r.join(" ")).join("\n"));
  if (headerIdx < 0) return { rows: [], ...period, error: "找不到「藥品代號」和「用量」欄。請確認檔案有欄位名稱那一列。" };
  const head = table[headerIdx].map(norm);
  const find = (names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  // 「成本合計」 also contains 成本: match exact names only.
  const ci = find(CODE), ni = find(NAME), pi = find(PRICE), qi = find(QTY), ai = find(AMOUNT), ki = find(COST), ri = find(RX);
  if (pi < 0) return { rows: [], ...period, error: "找不到「單價」欄。" };
  const rows: HisRow[] = [];
  for (const r of table.slice(headerIdx + 1)) {
    const code = String(r[ci] ?? "").trim().toUpperCase();
    const price = toNum(r[pi]);
    const qty = toNum(r[qi]);
    if (!code || !/^[A-Z0-9\-_.]+$/.test(code) || !Number.isFinite(price) || !Number.isFinite(qty) || qty === 0) continue;
    const amt = ai >= 0 ? toNum(r[ai]) : NaN;
    const cost = ki >= 0 ? toNum(r[ki]) : NaN;
    const rx = ri >= 0 ? toNum(r[ri]) : NaN;
    rows.push({
      code,
      name: ni >= 0 ? String(r[ni] ?? "").trim() : "",
      price,
      qty,
      amount: Number.isFinite(amt) ? amt : Math.round(price * qty),
      hisCost: Number.isFinite(cost) ? cost : null,
      rx: Number.isFinite(rx) ? Math.round(rx) : null,
    });
  }
  if (!rows.length) return { rows, ...period, error: "檔案裡沒有讀到任何耗用資料列。" };
  return { rows, ...period };
}

// One printed line of the report: 代號  簡稱 索引  單價  用量  合計  成本  成本合計  開藥次
const LINE = /^\s*([A-Z0-9]{5,14})\s+(.+?)\s+(-?[\d,]+\.\d+)\s+(-?[\d,]+(?:\.\d+)?)\s+(-?[\d,]+(?:\.\d+)?)\s+(-?[\d,]+\.\d+)\s+(-?[\d,]+(?:\.\d+)?)\s+(\d+)\s*$/i;

/**
 * Plain text of the printed report (Windows "Generic / Text Only" printer, or copied from the screen).
 * Falls back to a CSV/tab table when the text has delimiters.
 */
export function parseHisText(text: string): HisParse {
  const lines = text.split(/\r?\n/);
  const delimited = lines.filter((l) => l.includes("\t") || (l.match(/,/g)?.length ?? 0) >= 3).length;
  if (delimited >= 2) return parseHisTable(splitTable(lines), text);
  const period = findPeriod(text);
  const rows: HisRow[] = [];
  for (const l of lines) {
    const m = l.match(LINE);
    if (!m) continue;
    const [, code, name, price, qty, amount, cost, , rx] = m;
    const q = toNum(qty);
    if (!q) continue;
    // The 索引 column follows the name after a wide gap: drop it.
    rows.push({ code: code.toUpperCase(), name: name.trim().replace(/\s{2,}\S{1,10}$/, ""), price: toNum(price), qty: q, amount: toNum(amount), hisCost: toNum(cost), rx: Number(rx) });
  }
  if (!rows.length) return { rows, ...period, error: "讀不到報表內容。請上傳 CSV／Excel，或方鼎「印到純文字檔」的 TXT。" };
  return { rows, ...period };
}

function splitTable(lines: string[]): string[][] {
  const head = lines.find((l) => CODE.some((h) => l.includes(h))) ?? lines[0];
  const sep = (head.match(/\t/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? "\t" : ",";
  return lines.filter((l) => l.trim()).map((line) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else if (c === '"') q = true;
      else if (c === sep) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  });
}

export type PriceType = "NHI" | "SELF" | "FREE";
export const PRICE_TYPE_LABEL: Record<PriceType, string> = { NHI: "健保", SELF: "自費", FREE: "贈送" };

/** 0 元 = 贈送；等於健保價 = 健保；其他價格 = 自費（含優惠）。 */
export function classifyPrice(price: number, nhiPrice: number | null): PriceType {
  if (Math.abs(price) < 0.005) return "FREE";
  if (nhiPrice != null && Math.abs(price - nhiPrice) < 0.005) return "NHI";
  return "SELF";
}
