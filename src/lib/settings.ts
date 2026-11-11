import "server-only";
import { prisma } from "./db";

export type AppSettings = {
  inspectionEnabled: boolean; // 進貨需驗收後才入庫
  expiryWarnDays: number;
  expiryDangerDays: number;
  usageDays: number; // 自動安全量參考的耗用天數
  clinicName: string;
  consumptionNotes: string[]; // 耗用備註的常用選項
  noRevenueNotes: string[]; // 這些用途的耗用不算售價（贈送、損耗⋯）
  nhiPriceUrl: string; // 健保價格檔的下載網址
  digestEnabled: boolean; // 每日提醒信
  digestEmails: string[]; // 收件人
  digestSkipEmpty: boolean; // 沒有要提醒的事就不寄
};

const DEFAULTS: AppSettings = {
  inspectionEnabled: false,
  expiryWarnDays: 90,
  expiryDangerDays: 30,
  usageDays: 90,
  clinicName: "診所",
  consumptionNotes: ["門診扣庫", "各單位領用", "贈送", "損耗", "過期報廢"],
  noRevenueNotes: ["贈送", "損耗", "過期報廢"],
  nhiPriceUrl: "",
  digestEnabled: false,
  digestEmails: [],
  digestSkipEmpty: true,
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  return {
    inspectionEnabled: map.has("inspectionEnabled") ? map.get("inspectionEnabled") === "true" : DEFAULTS.inspectionEnabled,
    expiryWarnDays: Number(map.get("expiryWarnDays") ?? DEFAULTS.expiryWarnDays),
    expiryDangerDays: Number(map.get("expiryDangerDays") ?? DEFAULTS.expiryDangerDays),
    usageDays: Number(map.get("usageDays") ?? DEFAULTS.usageDays),
    clinicName: map.get("clinicName") ?? DEFAULTS.clinicName,
    consumptionNotes: map.has("consumptionNotes") ? splitLines(map.get("consumptionNotes")!) : DEFAULTS.consumptionNotes,
    noRevenueNotes: map.has("noRevenueNotes") ? splitLines(map.get("noRevenueNotes")!) : DEFAULTS.noRevenueNotes,
    nhiPriceUrl: map.get("nhiPriceUrl") ?? DEFAULTS.nhiPriceUrl,
    digestEnabled: map.get("digestEnabled") === "true",
    digestEmails: map.has("digestEmails") ? splitLines(map.get("digestEmails")!) : DEFAULTS.digestEmails,
    digestSkipEmpty: map.has("digestSkipEmpty") ? map.get("digestSkipEmpty") === "true" : DEFAULTS.digestSkipEmpty,
  };
}

export async function saveSettings(s: AppSettings) {
  const entries = Object.entries(s).map(([key, value]) => ({ key, value: Array.isArray(value) ? value.join("\n") : String(value) }));
  await prisma.$transaction(
    entries.map((e) => prisma.setting.upsert({ where: { key: e.key }, create: e, update: { value: e.value } })),
  );
}

/** One option per line; blank lines and repeats are dropped. */
export function splitLines(text: string): string[] {
  return [...new Set(text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean))];
}

/** Saves one setting without touching the others. */
export async function saveSetting(key: keyof AppSettings, value: string) {
  await prisma.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}
