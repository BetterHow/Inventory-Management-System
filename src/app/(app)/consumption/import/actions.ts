"use server";
import { revalidatePath } from "next/cache";
import { assertWrite, getAccess, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { applyHis, previewHis, undoHis, type ApplyRow } from "@/lib/his";
import type { HisRow } from "@/lib/hisParse";
import { attempt, done } from "@/lib/action";
import { audit } from "@/lib/audit";

export type HisPreview = Awaited<ReturnType<typeof previewHis>>;

export async function previewImport(rows: HisRow[], warehouseId: number, from: string, to: string): Promise<HisPreview> {
  await requireUser();
  if (!(await getAccess()).canRead(warehouseId)) throw new Error("沒有這個庫別的權限");
  return previewHis(rows, warehouseId, from, to);
}

export async function applyImport(a: { rows: ApplyRow[]; warehouseId: number; from: string; to: string; fileName: string | null }) {
  const user = await requireUser();
  if (!(await getAccess()).canWrite(a.warehouseId)) return { error: "您沒有修改這個庫別的權限，請洽管理員" };
  if (!a.from || !a.to) return { error: "請填報表日期" };
  if (a.from > a.to) return { error: "開始日期晚於結束日期" };
  const r = await applyHis({ ...a, userId: user.id });
  await audit("/consumption/import", "已匯入 HIS 耗用", `${a.from === a.to ? a.to : `${a.from}～${a.to}`}｜${r.count} 列${a.fileName ? `｜${a.fileName}` : ""}`);
  revalidatePath("/");
  revalidatePath("/consumption");
  revalidatePath("/consumption/import");
  return r;
}

export async function undoImport(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("id"));
  const imp = await prisma.hisImport.findUnique({ where: { id }, select: { warehouseId: true } });
  if (!imp) return done("/consumption/import", "這次匯入已經撤銷過了");
  await attempt("/consumption/import", () => assertWrite(imp.warehouseId));
  await undoHis(id);
  revalidatePath("/");
  return done("/consumption/import", "已撤銷這次匯入，庫存已加回", `匯入 #${id}`);
}
