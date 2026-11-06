"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt } from "@/lib/action";
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
  redirect(`/invoices/${id}?ok=` + encodeURIComponent("已建立發票"));
}

export async function updateInvoice(id: number, fd: FormData) {
  await requireUser();
  await attempt(`/invoices/${id}`, async () => {
    const number = str(fd, "number");
    if (!number) throw new UserError("請輸入發票號碼");
    const paid = bool(fd, "paid");
    await prisma.invoice.update({
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
  });
  revalidatePath("/invoices");
  redirect(`/invoices/${id}?ok=` + encodeURIComponent("已儲存"));
}

export async function deleteInvoice(id: number) {
  await requireUser();
  await prisma.receipt.updateMany({ where: { invoiceId: id }, data: { invoiceId: null } });
  await prisma.invoice.delete({ where: { id } });
  revalidatePath("/invoices");
  redirect("/invoices?ok=" + encodeURIComponent("已刪除發票，相關進貨單改回未對發票"));
}
