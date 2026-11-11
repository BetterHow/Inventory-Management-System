"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { applyHis, previewHis, undoHis, type ApplyRow } from "@/lib/his";
import type { HisRow } from "@/lib/hisParse";
import { done } from "@/lib/action";

export type HisPreview = Awaited<ReturnType<typeof previewHis>>;

export async function previewImport(rows: HisRow[], warehouseId: number, from: string, to: string): Promise<HisPreview> {
  await requireUser();
  return previewHis(rows, warehouseId, from, to);
}

export async function applyImport(a: { rows: ApplyRow[]; warehouseId: number; from: string; to: string; fileName: string | null }) {
  const user = await requireUser();
  if (!a.from || !a.to) return { error: "請填報表日期" };
  if (a.from > a.to) return { error: "開始日期晚於結束日期" };
  const r = await applyHis({ ...a, userId: user.id });
  revalidatePath("/");
  revalidatePath("/consumption");
  revalidatePath("/consumption/import");
  return r;
}

export async function undoImport(fd: FormData) {
  await requireUser();
  const id = Number(fd.get("id"));
  await undoHis(id);
  revalidatePath("/");
  return done("/consumption/import", "已撤銷這次匯入，庫存已加回");
}
