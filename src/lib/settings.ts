import "server-only";
import { prisma } from "./db";

export type AppSettings = {
  inspectionEnabled: boolean; // 進貨需驗收後才入庫
  expiryWarnDays: number;
  expiryDangerDays: number;
  usageDays: number; // 自動安全量參考的耗用天數
  clinicName: string;
};

const DEFAULTS: AppSettings = {
  inspectionEnabled: false,
  expiryWarnDays: 90,
  expiryDangerDays: 30,
  usageDays: 90,
  clinicName: "診所",
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
  };
}

export async function saveSettings(s: AppSettings) {
  const entries = Object.entries(s).map(([key, value]) => ({ key, value: String(value) }));
  await prisma.$transaction(
    entries.map((e) => prisma.setting.upsert({ where: { key: e.key }, create: e, update: { value: e.value } })),
  );
}
