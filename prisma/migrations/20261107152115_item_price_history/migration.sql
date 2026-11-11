-- CreateEnum
CREATE TYPE "PriceSource" AS ENUM ('MANUAL', 'NHI');

-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "nhiCheckedAt" TIMESTAMP(3),
ADD COLUMN     "nhiPrice" DECIMAL(14,2),
ADD COLUMN     "nhiPriceFrom" DATE,
ADD COLUMN     "priceSource" "PriceSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "ItemPrice" (
    "id" SERIAL NOT NULL,
    "itemId" INTEGER NOT NULL,
    "price" DECIMAL(14,2) NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "source" "PriceSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemPrice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItemPrice_itemId_effectiveFrom_idx" ON "ItemPrice"("itemId", "effectiveFrom");

-- AddForeignKey
ALTER TABLE "ItemPrice" ADD CONSTRAINT "ItemPrice_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Prices typed before this change apply to all past consumption
INSERT INTO "ItemPrice" ("itemId", "price", "effectiveFrom", "source")
SELECT "id", "salePrice", DATE '2000-01-01', 'MANUAL' FROM "Item" WHERE "salePrice" IS NOT NULL;
