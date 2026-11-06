-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultWarehouseId" INTEGER;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultWarehouseId_fkey" FOREIGN KEY ("defaultWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceiptLine" ADD CONSTRAINT "ReceiptLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
