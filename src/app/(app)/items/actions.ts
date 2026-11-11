"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { changes } from "@/lib/audit";

const ITEM_LABELS = { code: "料號", name: "品名", nhiCode: "健保碼", barcode: "條碼", spec: "規格", unit: "單位", categoryId: "類別", defaultSupplierId: "預設供應商", refPrice: "參考單價", salePrice: "健保價／售價", priceSource: "價格來源", trackBatch: "管批號", note: "備註", active: "啟用" };
import { UserError, bool, optInt, optNum, optStr, str } from "@/lib/form";
import { setItemPrice } from "@/lib/prices";
import { num } from "@/lib/format";
import type { Prisma } from "@prisma/client";

/** 健保價 items take the last imported 健保價; manual items take what was typed. */
async function savePrice(tx: Prisma.TransactionClient, itemId: number, fd: FormData) {
  const it = await tx.item.findUniqueOrThrow({ where: { id: itemId } });
  const price = it.priceSource === "NHI" ? (it.nhiPrice == null ? null : num(it.nhiPrice)) : optNum(fd, "salePrice");
  await setItemPrice(tx, itemId, price, it.priceSource);
}

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
    priceSource: str(fd, "priceSource") === "NHI" ? ("NHI" as const) : ("MANUAL" as const),
    trackBatch: bool(fd, "trackBatch"),
    note: optStr(fd, "note"),
    active: bool(fd, "active"),
  };
}

export async function createItem(fd: FormData) {
  await requireUser();
  await attempt("/items/new", async () => {
    await prisma.$transaction(async (tx) => {
      const it = await tx.item.create({ data: readItem(fd) });
      await savePrice(tx, it.id, fd);
    });
  });
  revalidatePath("/items");
  return done("/items", "已新增品項", `${str(fd, "code")} ${str(fd, "name")}`);
}

export async function updateItem(id: number, fd: FormData) {
  await requireUser();
  let detail = "";
  await attempt(`/items/${id}`, async () => {
    await prisma.$transaction(async (tx) => {
      const before = await tx.item.findUniqueOrThrow({ where: { id } });
      await tx.item.update({ where: { id }, data: readItem(fd) });
      await savePrice(tx, id, fd);
      const after = await tx.item.findUniqueOrThrow({ where: { id } });
      detail = `${after.code} ${after.name}　${changes(before, after, ITEM_LABELS) || "沒有變更"}`;
    });
  });
  revalidatePath("/items");
  return done("/items", "已修改品項", detail);
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
  return done(`/items/${itemId}`, "已儲存安全量設定", (await prisma.item.findUnique({ where: { id: itemId } }))?.name);
}
