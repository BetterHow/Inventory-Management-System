// Reading 健保署 price files. Plain functions, used in the browser (uploads) and on the server (web address).

export type NhiRow = { code: string; price: number; from: string | null; to: string | null };

const CODE_HEADERS = ["藥品代號", "藥品代碼", "健保碼", "健保代碼", "特材代碼", "特材代號", "品項代碼", "代碼", "代號"];
const PRICE_HEADERS = ["參考價", "健保參考價", "支付價", "支付點數", "健保價", "單價", "價格"];
const FROM_HEADERS = ["有效起日", "生效日", "起日", "生效起日"];
const TO_HEADERS = ["有效迄日", "迄日", "生效迄日"];

/** "1131101", "113/11/01", "2024-11-01", "20241101" → "2024-11-01". */
export function parseAnyDate(v: unknown): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  let y: number, m: number, d: number;
  const parts = s.split(/[\/\-.]/);
  if (parts.length === 3) [y, m, d] = parts.map((p) => Number(p.slice(0, 4)));
  else if (digits.length === 8) [y, m, d] = [+digits.slice(0, 4), +digits.slice(4, 6), +digits.slice(6, 8)];
  else if (digits.length === 7) [y, m, d] = [+digits.slice(0, 3), +digits.slice(3, 5), +digits.slice(5, 7)];
  else if (digits.length === 6) [y, m, d] = [+digits.slice(0, 2), +digits.slice(2, 4), +digits.slice(4, 6)];
  else return null;
  if (y < 1000) y += 1911; // 民國年
  if (!y || !m || !d || m > 12 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** UTF-8 if it reads cleanly, otherwise Big5 (older 健保署 files). */
export function decodeText(bytes: Uint8Array): string {
  const utf8 = new TextDecoder("utf-8").decode(bytes);
  if (!utf8.includes("�")) return utf8.replace(/^﻿/, "");
  return new TextDecoder("big5").decode(bytes);
}

function splitLine(line: string, sep: string): string[] {
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
}

/** CSV or tab-separated text → rows of cells. */
export function textToTable(text: string): string[][] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) return [];
  const head = lines.find((l) => CODE_HEADERS.some((h) => l.includes(h))) ?? lines[0];
  const sep = (head.match(/\t/g)?.length ?? 0) > (head.match(/,/g)?.length ?? 0) ? "\t" : ",";
  return lines.map((l) => splitLine(l, sep));
}

/** Finds the code / price / date columns by their header names. */
export function parseNhiTable(table: string[][]): { rows: NhiRow[]; error?: string } {
  const headerIdx = table.findIndex((r) => r.some((c) => CODE_HEADERS.includes(c.trim())));
  if (headerIdx < 0) return { rows: [], error: "找不到代碼欄（例如「藥品代號」或「健保碼」）。請確認檔案有欄位名稱那一列。" };
  const head = table[headerIdx].map((c) => c.trim());
  const find = (names: string[]) => names.map((n) => head.indexOf(n)).find((i) => i >= 0) ?? -1;
  const ci = find(CODE_HEADERS), pi = find(PRICE_HEADERS), fi = find(FROM_HEADERS), ti = find(TO_HEADERS);
  if (pi < 0) return { rows: [], error: "找不到價格欄（例如「參考價」或「支付點數」）。" };
  const rows: NhiRow[] = [];
  for (const r of table.slice(headerIdx + 1)) {
    const code = (r[ci] ?? "").trim().toUpperCase();
    const price = Number(String(r[pi] ?? "").replace(/,/g, ""));
    if (!code || !String(r[pi] ?? "").trim() || !Number.isFinite(price)) continue;
    rows.push({ code, price, from: fi >= 0 ? parseAnyDate(r[fi]) : null, to: ti >= 0 ? parseAnyDate(r[ti]) : null });
  }
  return { rows };
}
