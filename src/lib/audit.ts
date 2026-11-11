import "server-only";
import { prisma } from "./db";
import { getCurrentUser } from "./auth";

const AREAS: [string, string][] = [
  ["/consumption/import", "HIS 匯入"], ["/consumption", "耗用"], ["/receipts", "進貨單"], ["/purchase-list", "待採購"],
  ["/invoices", "發票"], ["/stocktakes", "盤點"], ["/transfers", "調撥"], ["/stock", "庫存"], ["/items/prices", "健保價"],
  ["/items", "品項"], ["/suppliers", "供應商"], ["/categories", "類別"], ["/warehouses", "庫別"], ["/users", "使用者"],
  ["/settings", "系統設定"], ["/account", "帳號"], ["/login", "登入"],
];
export const AREA_NAMES = [...new Set(AREAS.map(([, n]) => n))];

/** Writes one line of 操作紀錄. Never throws: a failed log must not undo the work it describes. */
export async function audit(path: string, action: string, detail?: string | null, who?: { id?: number; name: string }) {
  try {
    const user = who ?? (await getCurrentUser());
    const clean = path.split("?")[0];
    const area = AREAS.find(([p]) => clean.startsWith(p))?.[1] ?? "其他";
    await prisma.auditLog.create({
      data: { userId: user?.id, userName: user?.name ?? "", area, action, detail: detail?.slice(0, 2000) || null, path: clean },
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

/** "品名：A → B；售價：10 → 12" for the fields that changed. */
export function changes(before: Record<string, unknown>, after: Record<string, unknown>, labels: Record<string, string>): string {
  const show = (v: unknown) => (v == null || v === "" ? "（空白）" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "boolean" ? (v ? "是" : "否") : String(v));
  const out: string[] = [];
  for (const [k, label] of Object.entries(labels)) {
    if (!(k in after)) continue;
    const a = show(before[k]), b = show(after[k]);
    // Decimals read back as "12.00": compare as numbers when both are numeric.
    const same = a === b || (a !== "（空白）" && b !== "（空白）" && !isNaN(Number(a)) && !isNaN(Number(b)) && Number(a) === Number(b));
    if (!same) out.push(`${label}：${a} → ${b}`);
  }
  return out.join("；");
}

/** "藥局｜普拿疼 ×10、紗布 ×2" for documents with item lines. */
export async function linesText(warehouseId: number | null, lines: { itemId: number; qty: unknown }[]): Promise<string> {
  const [wh, items] = await Promise.all([
    warehouseId ? prisma.warehouse.findUnique({ where: { id: warehouseId }, select: { name: true } }) : null,
    prisma.item.findMany({ where: { id: { in: lines.map((l) => l.itemId) } }, select: { id: true, name: true } }),
  ]);
  const name = new Map(items.map((i) => [i.id, i.name]));
  const shown = lines.slice(0, 12).map((l) => `${name.get(l.itemId) ?? "?"} ×${Number(l.qty)}`).join("、");
  return `${wh ? wh.name + "｜" : ""}${shown}${lines.length > 12 ? `⋯等 ${lines.length} 項` : ""}`;
}
