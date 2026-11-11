"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { changes } from "@/lib/audit";
import { UserError, bool, intVal, optNum, optStr, str } from "@/lib/form";
import { dateOnly, num } from "@/lib/format";
import { sum, todayTaipei } from "@/lib/logic";

export async function createInvoice(fd: FormData) {
  await requireUser();
  const supplierId = intVal(fd, "supplierId");
  let id = 0;
  await attempt(`/invoices/new?supplier=${supplierId}`, async () => {
    const number = str(fd, "number");
    if (!number) throw new UserError("請輸入發票號碼");
    const receiptIds = fd.getAll("receiptIds").map(Number).filter(Boolean);
    const receipts = await prisma.receipt.findMany({ where: { id: { in: receiptIds }, supplierId } });
    const amount = optNum(fd, "amount") ?? sum(receipts.map((r) => num(r.totalAmount)));
    const inv = await prisma.invoice.create({
      data: {
        number,
        date: dateOnly(str(fd, "date") || todayTaipei()),
        supplierId,
        amount,
        taxAmount: optNum(fd, "taxAmount"),
        note: optStr(fd, "note"),
      },
    });
    await prisma.receipt.updateMany({ where: { id: { in: receipts.map((r) => r.id) } }, data: { invoiceId: inv.id } });
    id = inv.id;
  });
  revalidatePath("/invoices");
  return done(`/invoices/${id}`, "已建立發票", `發票 ${str(fd, "number")}`);
}

export async function updateInvoice(id: number, fd: FormData) {
  await requireUser();
  let detail = "";
  await attempt(`/invoices/${id}`, async () => {
    const number = str(fd, "number");
    if (!number) throw new UserError("請輸入發票號碼");
    const paid = bool(fd, "paid");
    const before = await prisma.invoice.findUniqueOrThrow({ where: { id } });
    const after = await prisma.invoice.update({
      where: { id },
      data: {
        number,
        date: dateOnly(str(fd, "date")),
        amount: optNum(fd, "amount") ?? 0,
        taxAmount: optNum(fd, "taxAmount"),
        note: optStr(fd, "note"),
        paid,
        paidAt: paid ? dateOnly(str(fd, "paidAt") || todayTaipei()) : null,
      },
    });
    detail = `發票 ${after.number}　${changes(before, after, { number: "號碼", date: "日期", amount: "金額", taxAmount: "稅額", paid: "已付款", paidAt: "付款日", note: "備註" }) || "沒有變更"}`;
  });
  revalidatePath("/invoices");
  return done(`/invoices/${id}`, "已修改發票", detail);
}

export async function deleteInvoice(id: number) {
  await requireUser();
  await prisma.receipt.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
  const inv = await prisma.invoice.delete({ where: { id } });
  revalidatePath("/invoices");
  return done("/invoices", "已刪除發票，相關進貨單改回未對發票", `發票 ${inv.number}，金額 ${inv.amount}`);
}
