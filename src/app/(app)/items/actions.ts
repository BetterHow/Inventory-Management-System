"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { UserError, bool, optInt, optNum, optStr, str } from "@/lib/form";

function readItem(fd: FormData) {
  const code = str(fd, "code");
  const name = str(fd, "name");
  if (!code || !name) throw new UserError("料號與品名必填");
  return {
    code,
    name,
    nhiCode: optStr(fd, "nhiCode"),
    barcode: optStr(fd, "barcode"),
    spec: optStr(fd, "spec"),
    unit: str(fd, "unit") || "個",
    categoryId: optInt(fd, "categoryId"),
    defaultSupplierId: optInt(fd, "defaultSupplierId"),
    refPrice: optNum(fd, "refPrice"),
    trackBatch: bool(fd, "trackBatch"),
    note: optStr(fd, "note"),
    active: bool(fd, "active"),
  };
}

export async function createItem(fd: FormData) {
  await requireUser();
  await attempt("/items/new", async () => {
    await prisma.item.create({ data: readItem(fd) });
  });
  revalidatePath("/items");
  return done("/items", "已新增品項");
}

export async function updateItem(id: number, fd: FormData) {
  await requireUser();
  await attempt(`/items/${id}`, async () => {
    await prisma.item.update({ where: { id }, data: readItem(fd) });
  });
  revalidatePath("/items");
  return done("/items", "已儲存");
}

/** Manual monthly usage per warehouse (blank = automatic). */
export async function saveItemSafety(itemId: number, fd: FormData) {
  await requireUser();
  const warehouses = await prisma.warehouse.findMany();
  await attempt(`/items/${itemId}`, async () => {
    for (const w of warehouses) {
      const v = optNum(fd, `manual_${w.id}`);
      await prisma.itemWarehouseSetting.upsert({
        where: { itemId_warehouseId: { itemId, warehouseId: w.id } },
        create: { itemId, warehouseId: w.id, manualMonthlyUsage: v },
        update: { manualMonthlyUsage: v },
      });
    }
  });
  revalidatePath("/stock");
  return done(`/items/${itemId}`, "已儲存安全量設定");
}
