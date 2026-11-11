-- AlterTable
ALTER TABLE "Item" ADD COLUMN     "ownerWarehouseId" INTEGER;

-- AlterTable
ALTER TABLE "Supplier" ADD COLUMN     "category" TEXT,
ADD COLUMN     "ownerWarehouseId" INTEGER;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "invoiceClerk" BOOLEAN NOT NULL DEFAULT false;
