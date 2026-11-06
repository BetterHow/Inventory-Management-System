"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { UserError, intVal, json, optNum, optStr, str } from "@/lib/form";
import { addStock, nextNumber } from "@/lib/stock";
import { getSettings } from "@/lib/settings";
import { dateOnly, num } from "@/lib/format";
import { movementTime, round2, sum, todayTaipei } from "@/lib/logic";
import type { Line } from "@/components/LineEditor";

type Tx = Prisma.TransactionClient;

function readLines(fd: FormData) {
  const lines = json<Line[]>(fd, "lines").filter((l) => Number(l.qty) > 0 || Number(l.freeQty) > 0);
  if (lines.length === 0) throw new UserError("請至少加入一個品項並填數量");
  return lines.map((l) => {
    const qty = Number(l.qty) || 0;
    const unitPrice = Number(l.unitPrice) || 0;
    // Amount is what the user typed; if left blank use qty × price. No tax is added.
    const amount = l.amount === "" || l.amount === undefined ? round2(qty * unitPrice) : Number(l.amount);
    return {
      itemId: l.itemId,
      qty,
      freeQty: Number(l.freeQty) || 0,
      unitPrice,
      amount,
      lotNo: (l.lotNo ?? "").trim(),
      expiryDate: l.expiryDate ? dateOnly(l.expiryDate) : null,
    };
  });
}

/** Put a receipt's lines into stock. Free goods lower the unit cost of the batch. */
async function receiveIntoStock(tx: Tx, receiptId: number, userId: number) {
  const r = await tx.receipt.findUniqueOrThrow({ where: { id: receiptId }, include: { lines: true } });
  const date = movementTime(r.date.toISOString().slice(0, 10));
  for (const l of r.lines) {
    const total = num(l.qty) + num(l.freeQty);
    if (total <= 0) continue;
    await addStock(tx, {
      itemId: l.itemId,
      warehouseId: r.warehouseId,
      qty: total,
      unitCost: Math.round((num(l.amount) / total) * 10000) / 10000,
      lotNo: l.lotNo,
      expiryDate: l.expiryDate,
      date,
      type: "RECEIPT",
      refType: "RECEIPT",
      refId: r.id,
      userId,
      note: r.number,
    });
  }
  await tx.receipt.update({ where: { id: r.id }, data: { status: "RECEIVED", receivedAt: new Date() } });
}

/** Optional invoice typed on the receipt form: one invoice for this receipt. */
async function maybeInvoice(tx: Tx, fd: FormData, supplierId: number, receiptId: number, total: number) {
  const number = optStr(fd, "invoiceNumber");
  if (!number) return;
  const inv = await tx.invoice.create({
    data: {
      number,
      date: dateOnly(str(fd, "invoiceDate") || todayTaipei()),
      supplierId,
      amount: optNum(fd, "invoiceAmount") ?? total,
      taxAmount: optNum(fd, "invoiceTax"),
    },
  });
  await tx.receipt.update({ where: { id: receiptId }, data: { invoiceId: inv.id } });
}

/** intent: "order" = 只下單（待入庫）; "arrive" = 已到貨（依設定送驗收或直接入庫）; "draft" = keep current status */
export async function saveReceipt(id: number | null, fd: FormData) {
  const user = await requireUser();
  const settings = await getSettings();
  const back = id ? `/receipts/${id}/edit` : "/receipts/new";
  let savedId = id ?? 0;
  await attempt(back, async () => {
    const supplierId = intVal(fd, "supplierId");
    const warehouseId = intVal(fd, "warehouseId");
    if (!supplierId) throw new UserError("請選擇供應商");
    const dateStr = str(fd, "date") || todayTaipei();
    const lines = readLines(fd);
    const total = sum(lines.map((l) => l.amount));
    const intent = str(fd, "intent");
    const arrive = intent === "arrive";

    await prisma.$transaction(async (tx) => {
      if (id) {
        const existing = await tx.receipt.findUniqueOrThrow({ where: { id } });
        if (existing.status === "RECEIVED" || existing.status === "CANCELLED") throw new UserError("已入庫或已取消的進貨單不能修改");
        await tx.receiptLine.deleteMany({ where: { receiptId: id } });
        await tx.receipt.update({
          where: { id },
          data: {
            date: dateOnly(dateStr), supplierId, warehouseId, note: optStr(fd, "note"), totalAmount: total,
            lines: { create: lines },
            ...(arrive ? { status: settings.inspectionEnabled ? "PENDING_INSPECTION" : existing.status } : {}),
          },
        });
      } else {
        const number = await nextNumber(tx, "R", "receipt", dateStr);
        const r = await tx.receipt.create({
          data: {
            number, date: dateOnly(dateStr), supplierId, warehouseId, note: optStr(fd, "note"), totalAmount: total,
            status: arrive && settings.inspectionEnabled ? "PENDING_INSPECTION" : "ORDERED",
            createdById: user.id,
            lines: { create: lines },
          },
        });
        savedId = r.id;
        await maybeInvoice(tx, fd, supplierId, r.id, total);
      }
      if (arrive && !settings.inspectionEnabled) await receiveIntoStock(tx, savedId, user.id);
    });
  });
  revalidatePath("/receipts");
  revalidatePath("/");
  return done(`/receipts/${savedId}`, "已儲存");
}

export async function inspectReceipt(id: number) {
  const user = await requireUser();
  await attempt(`/receipts/${id}`, async () => {
    await prisma.$transaction(async (tx) => {
      const r = await tx.receipt.findUniqueOrThrow({ where: { id } });
      if (r.status !== "PENDING_INSPECTION" && r.status !== "ORDERED") throw new UserError("這張進貨單不是待驗收狀態");
      await tx.receipt.update({ where: { id }, data: { inspectedById: user.id, inspectedAt: new Date() } });
      await receiveIntoStock(tx, id, user.id);
    });
  });
  revalidatePath("/receipts");
  return done(`/receipts/${id}`, "已驗收入庫");
}

export async function cancelReceipt(id: number) {
  await requireUser();
  await attempt(`/receipts/${id}`, async () => {
    const r = await prisma.receipt.findUniqueOrThrow({ where: { id } });
    if (r.status === "RECEIVED") throw new UserError("已入庫的進貨單不能取消，請用盤點或退貨調整");
    await prisma.receipt.update({ where: { id }, data: { status: "CANCELLED" } });
    await prisma.purchaseListEntry.deleteMany({ where: { receiptId: id } });
  });
  revalidatePath("/receipts");
  return done(`/receipts/${id}`, "已取消");
}

/** Attach this receipt to an existing invoice, or create a new one. */
export async function linkInvoice(id: number, fd: FormData) {
  await requireUser();
  await attempt(`/receipts/${id}`, async () => {
    const r = await prisma.receipt.findUniqueOrThrow({ where: { id } });
    const existingId = optNum(fd, "invoiceId");
    if (existingId) {
      await prisma.receipt.update({ where: { id }, data: { invoiceId: existingId } });
      return;
    }
    const number = str(fd, "invoiceNumber");
    if (!number) throw new UserError("請輸入發票號碼或選一張既有發票");
    const inv = await prisma.invoice.create({
      data: {
        number,
        date: dateOnly(str(fd, "invoiceDate") || todayTaipei()),
        supplierId: r.supplierId,
        amount: optNum(fd, "invoiceAmount") ?? num(r.totalAmount),
        taxAmount: optNum(fd, "invoiceTax"),
      },
    });
    await prisma.receipt.update({ where: { id }, data: { invoiceId: inv.id } });
  });
  revalidatePath(`/receipts/${id}`);
  return done(`/receipts/${id}`, "已設定發票");
}

export async function unlinkInvoice(id: number) {
  await requireUser();
  await prisma.receipt.update({ where: { id }, data: { invoiceId: null } });
  revalidatePath(`/receipts/${id}`);
}
