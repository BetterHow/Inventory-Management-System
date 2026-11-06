// Fills the database with sample data for trying the system out.
// Run `npm run db:seed` first, then `npm run db:demo`. Skipped when items already exist.
// On Vercel, set LOAD_DEMO_DATA=true for a trial deploy. Never set it for the real clinic.
import { PrismaClient } from "@prisma/client";
import { addStock, removeStock } from "../src/lib/stock";

const prisma = new PrismaClient();

const ITEMS = [
  { code: "MED001", name: "普拿疼 500mg", unit: "錠", cat: "藥品", price: 1.2, wh: "PH", daily: 40 },
  { code: "MED002", name: "胃乳片", unit: "錠", cat: "藥品", price: 0.8, wh: "PH", daily: 25 },
  { code: "MED003", name: "Amoxicillin 500mg", unit: "顆", cat: "藥品", price: 2.5, wh: "PH", daily: 18 },
  { code: "MED004", name: "人工淚液 0.5ml", unit: "支", cat: "藥品", price: 6, wh: "PH", daily: 12 },
  { code: "SUP001", name: "酒精棉片", unit: "片", cat: "醫療耗材", price: 0.5, wh: "NS", daily: 60 },
  { code: "SUP002", name: "無菌紗布 4x4", unit: "包", cat: "醫療耗材", price: 3, wh: "NS", daily: 15 },
  { code: "SUP003", name: "外科口罩", unit: "片", cat: "醫療耗材", price: 1.5, wh: "NS", daily: 30 },
  { code: "OPT001", name: "隱形眼鏡保養液 360ml", unit: "瓶", cat: "保養液", price: 180, wh: "OP", daily: 1.5 },
  { code: "OPT002", name: "抗藍光鏡片", unit: "副", cat: "眼鏡", price: 900, wh: "OP", daily: 0.4 },
];

async function main() {
  if ((await prisma.item.count()) > 0) {
    console.log("Items already exist, demo data skipped.");
    return;
  }
  const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
  await prisma.warehouse.upsert({ where: { code: "OP" }, update: {}, create: { code: "OP", name: "眼鏡部", sortOrder: 3 } });
  const wh = new Map((await prisma.warehouse.findMany()).map((w) => [w.code, w.id]));
  const cats = new Map((await prisma.category.findMany()).map((c) => [c.name, c.id]));
  const sup1 = await prisma.supplier.create({ data: { name: "大和藥品", paymentTerms: "月結30天", phone: "02-1234-5678" } });
  const sup2 = await prisma.supplier.create({ data: { name: "康健醫材", paymentTerms: "貨到付款" } });
  const sup3 = await prisma.supplier.create({ data: { name: "明視光學", paymentTerms: "月結" } });
  const supFor = (wh: string) => (wh === "PH" ? sup1 : wh === "NS" ? sup2 : sup3);

  const now = Date.now();
  const day = 86400000;
  let n = 0;
  for (const it of ITEMS) {
    const item = await prisma.item.create({
      data: {
        code: it.code, name: it.name, unit: it.unit, categoryId: cats.get(it.cat), refPrice: it.price,
        defaultSupplierId: supFor(it.wh).id, barcode: `471000000${String(++n).padStart(4, "0")}`,
      },
    });
    const warehouseId = wh.get(it.wh)!;
    // Two receipts ~100 and ~40 days ago, then daily consumption.
    for (const [ago, months] of [[100, 2], [55, 1.5], [20, 1.5]] as const) {
      const qty = Math.ceil(it.daily * 30 * months);
      const date = new Date(now - ago * day);
      const lot = `L${it.code.slice(-3)}${ago}`;
      const expiry = new Date(now + (ago === 100 ? 25 : ago === 55 ? 200 : 500) * day);
      const r = await prisma.receipt.create({
        data: {
          number: `R-DEMO-${it.code}-${ago}`, date, supplierId: supFor(it.wh).id, warehouseId, status: "RECEIVED",
          totalAmount: Math.round(qty * it.price), createdById: admin.id, receivedAt: date,
          lines: { create: [{ itemId: item.id, qty, unitPrice: it.price, amount: Math.round(qty * it.price), lotNo: lot, expiryDate: expiry }] },
        },
      });
      await prisma.$transaction((tx) =>
        addStock(tx, { itemId: item.id, warehouseId, qty, unitCost: it.price, lotNo: lot, expiryDate: expiry, date, type: "RECEIPT", refType: "RECEIPT", refId: r.id, userId: admin.id }),
      );
    }
    for (let d = 99; d >= 1; d--) {
      const q = Math.max(0, Math.round(it.daily * (0.6 + Math.random() * 0.8)));
      if (!q) continue;
      await prisma.$transaction((tx) =>
        removeStock(tx, { itemId: item.id, warehouseId, qty: q, date: new Date(now - d * day), type: "CONSUME", refType: "CONSUMPTION", userId: admin.id }),
      );
    }
  }
  console.log("Demo data created.");
}

main().finally(() => prisma.$disconnect());
