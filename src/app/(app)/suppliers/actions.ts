"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
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
  };
}

export async function createSupplier(fd: FormData) {
  await requireUser();
  await attempt("/suppliers/new", () => prisma.supplier.create({ data: read(fd) }));
  return done("/suppliers", "已新增供應商", str(fd, "name"));
}

export async function updateSupplier(id: number, fd: FormData) {
  await requireUser();
  let detail = "";
  await attempt(`/suppliers/${id}`, async () => {
    const before = await prisma.supplier.findUniqueOrThrow({ where: { id } });
    const after = await prisma.supplier.update({ where: { id }, data: read(fd) });
    detail = `${after.name}　${changes(before, after, { name: "名稱", taxId: "統編", contact: "聯絡人", phone: "電話", paymentTerms: "付款條件", note: "備註", active: "啟用" }) || "沒有變更"}`;
  });
  return done("/suppliers", "已修改供應商", detail);
}
