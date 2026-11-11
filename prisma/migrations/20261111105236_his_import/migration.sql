-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "priceType" TEXT,
ADD COLUMN     "revenue" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "HisImport" (
    "id" SERIAL NOT NULL,
    "dateFrom" DATE NOT NULL,
    "dateTo" DATE NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "fileName" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "qty" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HisImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HisImportLine" (
    "id" SERIAL NOT NULL,
    "importId" INTEGER NOT NULL,
    "hisCode" TEXT NOT NULL,
    "hisName" TEXT NOT NULL,
    "itemId" INTEGER,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "hisQty" DECIMAL(12,2) NOT NULL,
    "qty" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "hisCost" DECIMAL(14,2),
    "rxCount" INTEGER,
    "priceType" TEXT NOT NULL,
    "cost" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "HisImportLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HisCodeMap" (
    "hisCode" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "factor" DECIMAL(12,4) NOT NULL DEFAULT 1,

    CONSTRAINT "HisCodeMap_pkey" PRIMARY KEY ("hisCode")
);

-- CreateIndex
CREATE INDEX "HisImport_dateTo_idx" ON "HisImport"("dateTo");

-- CreateIndex
CREATE INDEX "HisImportLine_itemId_idx" ON "HisImportLine"("itemId");

-- AddForeignKey
ALTER TABLE "HisImportLine" ADD CONSTRAINT "HisImportLine_importId_fkey" FOREIGN KEY ("importId") REFERENCES "HisImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HisCodeMap" ADD CONSTRAINT "HisCodeMap_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
