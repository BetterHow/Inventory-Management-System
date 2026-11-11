-- CreateTable
CREATE TABLE "UserWarehouseAccess" (
    "userId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "level" TEXT NOT NULL,

    CONSTRAINT "UserWarehouseAccess_pkey" PRIMARY KEY ("userId","warehouseId")
);

-- AddForeignKey
ALTER TABLE "UserWarehouseAccess" ADD CONSTRAINT "UserWarehouseAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserWarehouseAccess" ADD CONSTRAINT "UserWarehouseAccess_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
