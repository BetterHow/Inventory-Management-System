import "server-only";
import { prisma } from "./db";
import { fmtDate, fmtQty, num, RECEIPT_STATUS_LABEL } from "./format";
import { stockOverview } from "./overview";
import { getSettings } from "./settings";
import { SAFETY_LABEL, todayTaipei } from "./logic";

export type DigestSection = {
  warehouse: string;
  low: { code: string; name: string; stock: string; note: string }[]; // 負庫存或不足 1 個月
  expiring: { code: string; name: string; lot: string; expiry: string; qty: string; days: number }[];
  pending: { number: string; supplier: string; status: string; date: string }[]; // 待入庫、待驗收
};
export type Digest = { date: string; clinic: string; sections: DigestSection[]; count: number };

/** What needs attention today, per department: low stock, batches near expiry, receipts not yet in stock. */
export async function buildDigest(): Promise<Digest> {
  const s = await getSettings();
  const warehouses = await prisma.warehouse.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const now = new Date();
  const limit = new Date(now.getTime() + s.expiryWarnDays * 86400000);
  const sections: DigestSection[] = [];
  for (const w of warehouses) {
    const [rows, batches, receipts] = await Promise.all([
      stockOverview(w.id),
      prisma.batch.findMany({
        where: { warehouseId: w.id, qty: { gt: 0 }, expiryDate: { not: null, lte: limit } },
        include: { item: { select: { code: true, name: true, unit: true } } },
        orderBy: { expiryDate: "asc" },
      }),
      prisma.receipt.findMany({
        where: { warehouseId: w.id, status: { in: ["ORDERED", "PENDING_INSPECTION"] } },
        include: { supplier: { select: { name: true } } },
        orderBy: { date: "asc" },
      }),
    ]);
    const sec: DigestSection = {
      warehouse: w.name,
      low: rows
        .filter((r) => r.inWarehouse && (r.status === "NEGATIVE" || r.status === "LT1"))
        .map((r) => ({ code: r.code, name: r.name, stock: `${fmtQty(r.stock)} ${r.unit}`, note: `${SAFETY_LABEL[r.status]}${r.monthlyUsage ? `（月用量 ${fmtQty(r.monthlyUsage)}）` : ""}` })),
      expiring: batches.map((b) => ({
        code: b.item.code, name: b.item.name, lot: b.lotNo ?? "", expiry: fmtDate(b.expiryDate, true), qty: `${fmtQty(b.qty)} ${b.item.unit}`,
        days: Math.ceil((b.expiryDate!.getTime() - now.getTime()) / 86400000),
      })),
      pending: receipts.map((r) => ({ number: r.number, supplier: r.supplier?.name ?? "", status: RECEIPT_STATUS_LABEL[r.status] ?? r.status, date: fmtDate(r.date, true) })),
    };
    if (sec.low.length + sec.expiring.length + sec.pending.length) sections.push(sec);
  }
  return { date: todayTaipei(), clinic: s.clinicName, sections, count: sections.reduce((n, x) => n + x.low.length + x.expiring.length + x.pending.length, 0) };
}

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function table(head: string[], rows: string[][]) {
  const td = 'style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:left;font-size:14px"';
  return `<table style="border-collapse:collapse;width:100%;margin:6px 0 18px"><tr>${head.map((h) => `<th ${td.replace("font-size:14px", "font-size:12px;color:#64748b")}>${h}</th>`).join("")}</tr>${rows
    .map((r) => `<tr>${r.map((c) => `<td ${td}>${esc(c)}</td>`).join("")}</tr>`)
    .join("")}</table>`;
}

export function digestSubject(d: Digest) {
  const low = d.sections.reduce((n, s) => n + s.low.length, 0), exp = d.sections.reduce((n, s) => n + s.expiring.length, 0);
  return `【${d.clinic}庫存】${d.date}　${d.count ? `庫存不足 ${low} 項、近效期 ${exp} 批` : "今天沒有需要處理的項目"}`;
}

export function digestHtml(d: Digest, appUrl?: string) {
  const h3 = 'style="margin:0;font-size:14px;color:#0f766e"';
  const body = d.sections.length
    ? d.sections.map((s) =>
        `<h2 style="margin:22px 0 8px;font-size:17px;border-left:4px solid #0d9488;padding-left:8px">${esc(s.warehouse)}</h2>` +
        (s.low.length ? `<h3 ${h3}>庫存不足（${s.low.length}）</h3>` + table(["料號", "品名", "庫存", "狀態"], s.low.map((r) => [r.code, r.name, r.stock, r.note])) : "") +
        (s.expiring.length ? `<h3 ${h3}>近效期（${s.expiring.length}）</h3>` + table(["料號", "品名", "批號", "效期", "數量", ""], s.expiring.map((r) => [r.code, r.name, r.lot, r.expiry, r.qty, r.days < 0 ? "已過期" : `剩 ${r.days} 天`])) : "") +
        (s.pending.length ? `<h3 ${h3}>還沒入庫的進貨單（${s.pending.length}）</h3>` + table(["單號", "供應商", "狀態", "日期"], s.pending.map((r) => [r.number, r.supplier, r.status, r.date])) : ""),
      ).join("")
    : `<p>今天沒有庫存不足、近效期或待入庫的項目。</p>`;
  return `<div style="font-family:-apple-system,'Segoe UI','PingFang TC','Microsoft JhengHei',sans-serif;color:#0f172a;max-width:720px"><h1 style="font-size:19px;margin:0 0 4px">${esc(d.clinic)} 庫存每日提醒</h1><p style="margin:0;color:#64748b;font-size:13px">${d.date}</p>${body}${appUrl ? `<p style="margin-top:20px"><a href="${appUrl}" style="color:#0d9488">打開庫存系統</a></p>` : ""}<p style="color:#94a3b8;font-size:12px">這封信由系統自動寄出。收件人可在「系統設定」調整。</p></div>`;
}

export function appUrl() {
  const u = process.env.APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return u ? (u.startsWith("http") ? u : `https://${u}`) : undefined;
}

export const mailReady = () => Boolean(process.env.RESEND_API_KEY);

/** Sends through Resend (https://resend.com). Needs RESEND_API_KEY; MAIL_FROM is optional. */
export async function sendMail(to: string[], subject: string, html: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "還沒設定寄信金鑰（RESEND_API_KEY）" };
  if (!to.length) return { ok: false, error: "還沒填收件人" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: process.env.MAIL_FROM || "庫存提醒 <onboarding@resend.dev>", to, subject, html }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text();
    return { ok: false, error: `寄信服務回覆 ${res.status}：${body.slice(0, 200)}` };
  } catch (e) {
    return { ok: false, error: `連不上寄信服務：${(e as Error).message}` };
  }
}

/** The daily run. `force` sends even when switched off or empty (the "send a test" button). */
export async function sendDigest(force = false): Promise<{ sent: boolean; reason?: string; to?: string[] }> {
  const s = await getSettings();
  if (!force && !s.digestEnabled) return { sent: false, reason: "每日提醒沒有開啟" };
  const d = await buildDigest();
  if (!force && s.digestSkipEmpty && !d.count) return { sent: false, reason: "今天沒有要提醒的項目" };
  const r = await sendMail(s.digestEmails, digestSubject(d), digestHtml(d, appUrl()));
  return r.ok ? { sent: true, to: s.digestEmails } : { sent: false, reason: r.error };
}
