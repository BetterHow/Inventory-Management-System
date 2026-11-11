"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertWrite, requireUser } from "@/lib/auth";
import { linesText } from "@/lib/audit";
import { attempt, done } from "@/lib/action";
import { UserError, intVal, json, optStr, str } from "@/lib/form";
import { removeStock } from "@/lib/stock";
import { movementTime } from "@/lib/logic";
import type { Line } from "@/components/LineEditor";

export async function createConsumption(fd: FormData) {
  const user = await requireUser();
  const warnings: string[] = [];
  let detail = "";
  await attempt("/consumption/new", async () => {
    const warehouseId = intVal(fd, "warehouseId");
    await assertWrite(warehouseId);
    const dateStr = str(fd, "date");
    if (!dateStr) throw new UserError("請選擇日期");
    // Use noon Taiwan time unless it's today, so the record lands on the chosen day.
    const date = movementTime(dateStr);
    const lines = json<Line[]>(fd, "lines").filter((l) => Number(l.qty) > 0);
    if (lines.length === 0) throw new UserError("請至少加入一個品項並填數量");
    detail = `${dateStr}｜${await linesText(warehouseId, lines)}${optStr(fd, "note") ? `｜${optStr(fd, "note")}` : ""}`;

    await prisma.$transaction(async (tx) => {
      const c = await tx.consumption.create({
        data: { date, warehouseId, note: optStr(fd, "note"), createdById: user.id },
      });
      for (const l of lines) {
        const r = await removeStock(tx, {
          itemId: l.itemId,
          warehouseId,
          qty: Number(l.qty),
          batchId: l.batchId ? Number(l.batchId) : null,
          date,
          type: "CONSUME",
          refType: "CONSUMPTION",
          refId: c.id,
          note: optStr(fd, "note"),
          userId: user.id,
        });
        if (r.shortfall > 0) {
          const item = await tx.item.findUnique({ where: { id: l.itemId } });
          warnings.push(`${item?.name} 庫存不足 ${r.shortfall}，已變成負庫存`);
        }
      }
    });
  });
  revalidatePath("/");
  return done(warnings.length ? `/consumption?warn=${encodeURIComponent(warnings.join("；"))}` : "/consumption", "已登記耗用", detail);
}
