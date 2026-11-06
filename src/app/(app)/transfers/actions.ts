"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt } from "@/lib/action";
import { UserError, intVal, json, optStr, str } from "@/lib/form";
import { addStock, nextNumber, removeStock } from "@/lib/stock";
import { movementTime, todayTaipei } from "@/lib/logic";
import type { Line } from "@/components/LineEditor";

export async function createTransfer(fd: FormData) {
  const user = await requireUser();
  const warnings: string[] = [];
  await attempt("/transfers/new", async () => {
    const from = intVal(fd, "warehouseId");
    const to = intVal(fd, "toWarehouseId");
    if (from === to) throw new UserError("調出與調入庫別不能相同");
    const dateStr = str(fd, "date") || todayTaipei();
    const date = movementTime(dateStr);
    const lines = json<Line[]>(fd, "lines").filter((l) => Number(l.qty) > 0);
    if (lines.length === 0) throw new UserError("請至少加入一個品項並填數量");
    await prisma.$transaction(async (tx) => {
      const t = await tx.transfer.create({
        data: {
          number: await nextNumber(tx, "T", "transfer", dateStr),
          date, fromWarehouseId: from, toWarehouseId: to, note: optStr(fd, "note"), createdById: user.id,
        },
      });
      const common = { date, refType: "TRANSFER", refId: t.id, userId: user.id, note: t.number };
      for (const l of lines) {
        const r = await removeStock(tx, {
          ...common, itemId: l.itemId, warehouseId: from, qty: Number(l.qty),
          batchId: l.batchId ? Number(l.batchId) : null, type: "TRANSFER_OUT",
        });
        if (r.shortfall > 0) {
          const item = await tx.item.findUnique({ where: { id: l.itemId } });
          warnings.push(`${item?.name} 調出庫別庫存不足 ${r.shortfall}，已變成負庫存`);
        }
        // Keep lot, expiry and cost when moving into the other warehouse.
        for (const m of r.moved) {
          const b = await tx.batch.findUniqueOrThrow({ where: { id: m.batchId } });
          await addStock(tx, {
            ...common, itemId: l.itemId, warehouseId: to, qty: m.qty, unitCost: m.unitCost,
            lotNo: b.lotNo, expiryDate: b.expiryDate, type: "TRANSFER_IN",
          });
        }
      }
    });
  });
  revalidatePath("/transfers");
  const q = new URLSearchParams({ ok: "已完成調撥" });
  if (warnings.length) q.set("warn", warnings.join("；"));
  redirect(`/transfers?${q}`);
}
