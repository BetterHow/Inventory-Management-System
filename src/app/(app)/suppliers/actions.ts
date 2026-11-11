"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertOwnerWrite, requireUser } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { changes } from "@/lib/audit";
import { UserError, bool, optStr, str } from "@/lib/form";

function read(fd: FormData) {
  const name = str(fd, "name");
  if (!name) throw new UserError("供應商名稱必填");
  return {
    name,
    taxId: optStr(fd, "taxId"),
    contact: optStr(fd, "contact"),
    phone: optStr(fd, "phone"),
    paymentTerms: optStr(fd, "paymentTerms"),
    note: optStr(fd, "note"),
    active: bool(fd, "active"),
    category: optStr(fd, "category"),
    ownerWarehouseId: Number(fd.get("ownerWarehouseId")) > 0 ? Number(fd.get("ownerWarehouseId")) : null,
  };
}

export async function createSupplier(fd: FormData) {
  await requireUser();
  await attempt("/suppliers/new", async () => {
    const data = read(fd);
    await assertOwnerWrite(data.ownerWarehouseId);
    await prisma.supplier.create({ data });
  });
  return done("/suppliers", "已新增供應商", str(fd, "name"));
}

export async function updateSupplier(id: number, fd: FormData) {
  await requireUser();
  let detail = "";
  await attempt(`/suppliers/${id}`, async () => {
    const before = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    const data = read(fd);
    await assertOwnerWrite(before.ownerWarehouseId, data.ownerWarehouseId);
    const after = await prisma.supplier.update({ where: { id }, data });
    detail = `${after.name}　${changes(before, after, { name: "名稱", taxId: "統編", contact: "聯絡人", phone: "電話", paymentTerms: "付款條件", note: "備註", active: "啟用", category: "分類", ownerWarehouseId: "所屬部門" }) || "沒有變更"}`;
  });
  return done("/suppliers", "已修改供應商", detail);
}
