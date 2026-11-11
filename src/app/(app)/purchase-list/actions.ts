"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { assertWrite, requireUser } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { UserError, intVal, numVal, optInt, optStr, str, withParam } from "@/lib/form";
import { nextNumber } from "@/lib/stock";
import { dateOnly, num } from "@/lib/format";
import { round2, todayTaipei } from "@/lib/logic";

export async function addEntry(fd: FormData) {
  const user = await requireUser();
  const back = str(fd, "back") || "/purchase-list";
  await attempt(back, async () => {
    const code = str(fd, "item");
    const item = await prisma.item.findFirst({
      where: { OR: [{ code: code.split("｜")[0] }, { barcode: code }, { name: code }] },
    });
    if (!item) throw new UserError(`找不到品項「${code}」`);
    const qty = numVal(fd, "qty");
    if (qty <= 0) throw new UserError("數量要大於 0");
    await assertWrite(intVal(fd, "warehouseId"));
    await prisma.purchaseListEntry.create({
      data: {
        itemId: item.id,
        warehouseId: intVal(fd, "warehouseId"),
        supplierId: optInt(fd, "supplierId") ?? item.defaultSupplierId,
        qty,
        note: optStr(fd, "note"),
        createdById: user.id,
      },
    });
  });
  revalidatePath("/purchase-list");
  return done(back, "已加入待採購清單");
}

export async function bulkAction(fd: FormData) {
  const user = await requireUser();
  const ids = fd.getAll("ids").map(Number).filter(Boolean);
  const action = str(fd, "action");
  let msg = "";
  await attempt("/purchase-list", async () => {
    if (ids.length === 0) throw new UserError("請先勾選項目");
    const entries = await prisma.purchaseListEntry.findMany({ where: { id: { in: ids }, status: "PENDING" } });
    await assertWrite(...new Set(entries.map((e) => e.warehouseId)));
    if (action === "clear") {
      await prisma.purchaseListEntry.deleteMany({ where: { id: { in: entries.map((e) => e.id) } } });
      msg = `已刪除 ${entries.length} 項`;
      return;
    }
    // Turn into "待入庫" receipts, one per supplier + warehouse.
    if (entries.some((e) => !e.supplierId)) throw new UserError("有項目沒有指定供應商，請先設定再轉進貨單");
    const groups = new Map<string, typeof entries>();
    for (const e of entries) {
      const k = `${e.supplierId}:${e.warehouseId}`;
      groups.set(k, [...(groups.get(k) ?? []), e]);
    }
    const items = new Map((await prisma.item.findMany({ where: { id: { in: entries.map((e) => e.itemId) } } })).map((i) => [i.id, i]));
    const today = todayTaipei();
    await prisma.$transaction(async (tx) => {
      for (const group of groups.values()) {
        const lines = group.map((e) => {
          const price = num(items.get(e.itemId)?.refPrice);
          return { itemId: e.itemId, qty: num(e.qty), unitPrice: price, amount: round2(num(e.qty) * price) };
        });
        const r = await tx.receipt.create({
          data: {
            number: await nextNumber(tx, "R", "receipt", today),
            date: dateOnly(today),
            supplierId: group[0].supplierId!,
            warehouseId: group[0].warehouseId,
            status: "ORDERED",
            totalAmount: round2(lines.reduce((s, l) => s + l.amount, 0)),
            createdById: user.id,
            note: "由待採購清單轉入",
            lines: { create: lines },
          },
        });
        await tx.purchaseListEntry.updateMany({ where: { id: { in: group.map((e) => e.id) } }, data: { status: "ORDERED", receiptId: r.id } });
      }
    });
    msg = `已轉成 ${groups.size} 張待入庫進貨單`;
  });
  revalidatePath("/purchase-list");
  return done("/purchase-list", msg);
}

export async function deleteEntry(id: number) {
  await requireUser();
  await attempt("/purchase-list", async () => {
    const e = await prisma.purchaseListEntry.findUnique({ where: { id } });
    if (e) await assertWrite(e.warehouseId);
  });
  await prisma.purchaseListEntry.deleteMany({ where: { id, status: "PENDING" } });
  revalidatePath("/purchase-list");
  return done("/purchase-list", "已刪除");
}

/** Adds the ticked 補貨建議 to the list with the quantities shown (editable). */
export async function addSuggestions(fd: FormData) {
  const user = await requireUser();
  const picked = fd.getAll("s").map(String);
  let n = 0;
  await attempt("/purchase-list", async () => {
    if (!picked.length) throw new UserError("請先勾選要加入的品項");
    await assertWrite(...new Set(picked.map((k) => Number(k.split(":")[0]))));
    const ids = [...new Set(picked.map((k) => Number(k.split(":")[1])))];
    const items = new Map((await prisma.item.findMany({ where: { id: { in: ids } } })).map((i) => [i.id, i]));
    const data = picked.flatMap((k) => {
      const [wid, itemId] = k.split(":").map(Number);
      const qty = Number(fd.get(`q:${k}`));
      if (!items.has(itemId) || !(qty > 0)) return [];
      return [{ itemId, warehouseId: wid, supplierId: items.get(itemId)!.defaultSupplierId, qty, note: "補貨建議", createdById: user.id }];
    });
    await prisma.purchaseListEntry.createMany({ data });
    n = data.length;
  });
  revalidatePath("/purchase-list");
  return done("/purchase-list", `已加入 ${n} 項補貨建議`);
}
