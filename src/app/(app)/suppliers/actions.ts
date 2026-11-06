"use server";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt } from "@/lib/action";
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
  redirect("/suppliers?ok=" + encodeURIComponent("已新增供應商"));
}

export async function updateSupplier(id: number, fd: FormData) {
  await requireUser();
  await attempt(`/suppliers/${id}`, () => prisma.supplier.update({ where: { id }, data: read(fd) }));
  redirect("/suppliers?ok=" + encodeURIComponent("已儲存"));
}
