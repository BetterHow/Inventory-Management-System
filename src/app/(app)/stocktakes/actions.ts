"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertWrite, requireUser } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { UserError, intVal, optInt, optStr, str } from "@/lib/form";
import { addStock, nextNumber, removeStock, stockByItem } from "@/lib/stock";
import { sortFefo, todayTaipei } from "@/lib/logic";
import { num } from "@/lib/format";

export async function createStocktake(fd: FormData) {
  const user = await requireUser();
  let id = 0;
  await attempt("/stocktakes", async () => {
    const warehouseId = intVal(fd, "warehouseId");
    await assertWrite(warehouseId);
    const categoryId = optInt(fd, "categoryId");
    await prisma.$transaction(async (tx) => {
      const stock = await stockByItem(tx, warehouseId);
      const items = await tx.item.findMany({
        where: { active: true, ...(categoryId ? { categoryId } : {}) },
        orderBy: { code: "asc" },
      });
      if (items.length === 0) throw new UserError("沒有可盤點的品項");
      const s = await tx.stocktake.create({
        data: {
          number: await nextNumber(tx, "S", "stocktake", todayTaipei()),
          date: new Date(), warehouseId, note: optStr(fd, "note"), createdById: user.id,
          lines: { create: items.map((i) => ({ itemId: i.id, systemQty: stock.get(i.id) ?? 0 })) },
        },
      });
      id = s.id;
    });
  });
  redirect(`/stocktakes/${id}`);
}

export async function saveCounts(id: number, fd: FormData) {
  const user = await requireUser();
  const finish = str(fd, "intent") === "finish";
  await attempt(`/stocktakes/${id}`, async () => {
    await prisma.$transaction(async (tx) => {
      const st = await tx.stocktake.findUniqueOrThrow({ where: { id }, include: { lines: true } });
      await assertWrite(st.warehouseId);
      if (st.status === "DONE") throw new UserError("這張盤點單已完成");
      for (const l of st.lines) {
        const v = str(fd, `c_${l.id}`);
        await tx.stocktakeLine.update({ where: { id: l.id }, data: { countedQty: v === "" ? null : Number(v) } });
      }
      if (!finish) return;
      // Compare with stock at the moment of finishing, so usage during the count is not lost.
      const stock = await stockByItem(tx, st.warehouseId);
      const now = new Date();
      for (const l of st.lines) {
        const v = str(fd, `c_${l.id}`);
        if (v === "") continue;
        const diff = Math.round((Number(v) - (stock.get(l.itemId) ?? 0)) * 100) / 100;
        if (diff === 0) continue;
        const common = { itemId: l.itemId, warehouseId: st.warehouseId, date: now, type: "ADJUST" as const, refType: "STOCKTAKE", refId: st.id, userId: user.id, note: st.number };
        if (diff < 0) {
          await removeStock(tx, { ...common, qty: -diff });
        } else {
          // Extra found: add to the latest-expiring batch, or a new one at the reference price.
          const batches = await tx.batch.findMany({ where: { itemId: l.itemId, warehouseId: st.warehouseId } });
          const last = sortFefo(batches.map((b) => ({ ...b, qty: num(b.qty) }))).at(-1);
          const item = await tx.item.findUniqueOrThrow({ where: { id: l.itemId } });
          await addStock(tx, {
            ...common, qty: diff,
            unitCost: last ? num(last.unitCost) : num(item.refPrice),
            lotNo: last?.lotNo ?? "", expiryDate: last?.expiryDate ?? null,
          });
        }
      }
      await tx.stocktake.update({ where: { id }, data: { status: "DONE", completedAt: now } });
    });
  });
  revalidatePath("/stocktakes");
  const st = await prisma.stocktake.findUnique({ where: { id }, select: { number: true } });
  return done(`/stocktakes/${id}`, finish ? "盤點完成，已調整庫存" : "已暫存盤點", st?.number);
}

export async function deleteStocktake(id: number) {
  await requireUser();
  const st = await prisma.stocktake.findUniqueOrThrow({ where: { id } });
  await attempt(`/stocktakes/${id}`, () => assertWrite(st.warehouseId));
  if (st.status === "DONE") redirect(`/stocktakes/${id}?error=` + encodeURIComponent("已完成的盤點不能刪除"));
  await prisma.stocktake.delete({ where: { id } });
  redirect("/stocktakes");
}
