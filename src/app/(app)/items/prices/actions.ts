"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { applyNhiPrices, parseNhiFile, previewNhiPrices, type NhiRow } from "@/lib/prices";
import { saveSetting } from "@/lib/settings";
import { done } from "@/lib/action";

export type Preview = Awaited<ReturnType<typeof previewNhiPrices>> & { error?: string; source: string };

/** Rows already read in the browser (only the codes we use, so the upload stays small). */
export async function previewRows(rows: NhiRow[], fileName: string): Promise<Preview> {
  await requireUser();
  return { ...(await previewNhiPrices(rows)), source: fileName };
}

/** Downloads the 健保署 file from a web address and compares it. The address is remembered. */
export async function previewUrl(url: string): Promise<Preview> {
  await requireUser();
  const empty = { fileRows: 0, codes: 0, changes: [], same: [], notFound: [], source: url };
  if (!/^https?:\/\//i.test(url)) return { ...empty, error: "請輸入完整網址（http:// 或 https:// 開頭）" };
  await saveSetting("nhiPriceUrl", url);
  let buf: Buffer;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!res.ok) return { ...empty, error: `下載失敗（伺服器回應 ${res.status}）` };
    buf = Buffer.from(await res.arrayBuffer());
  } catch {
    return { ...empty, error: "連不上這個網址。健保署網站有時會擋國外主機，可改用「上傳檔案」。" };
  }
  const name = new URL(url).pathname.split("/").pop() || "download";
  const { rows, error } = await parseNhiFile(buf, name);
  if (error) return { ...empty, error };
  return { ...(await previewNhiPrices(rows)), source: url };
}

export async function applyRows(fd: FormData) {
  await requireUser();
  const list = JSON.parse(String(fd.get("changes") ?? "[]")) as { itemId: number; price: number; from: string | null }[];
  const updated = await applyNhiPrices(list);
  revalidatePath("/items");
  return done("/items/prices", `已更新 ${list.length} 個品項的健保價，其中 ${updated} 個品項的售價跟著改了`);
}
