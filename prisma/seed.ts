// First-time setup: one admin account, a default warehouse and categories.
// Run with `npm run db:seed`. Safe to run again; existing data is kept.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!password || password.length < 8) throw new Error("Set SEED_ADMIN_PASSWORD (8+ characters) before seeding");
  await prisma.user.upsert({
    where: { username: "admin" },
    update: {},
    create: { username: "admin", name: "管理員", role: "ADMIN", passwordHash: await bcrypt.hash(password, 10) },
  });
  const warehouses = [
    { code: "PH", name: "藥局", sortOrder: 1 },
    { code: "NS", name: "護理部", sortOrder: 2 },
  ];
  for (const w of warehouses) await prisma.warehouse.upsert({ where: { code: w.code }, update: {}, create: w });
  const categories = ["藥品", "醫療耗材", "眼鏡", "保養液", "其他"];
  for (const [i, name] of categories.entries())
    await prisma.category.upsert({ where: { name }, update: {}, create: { name, sortOrder: i + 1 } });
  console.log("Seed done. Log in as admin with SEED_ADMIN_PASSWORD.");
}

main().finally(() => prisma.$disconnect());
