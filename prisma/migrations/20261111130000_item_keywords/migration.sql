-- 搜尋關鍵字（像方鼎的藥品索引）
ALTER TABLE "Item" ADD COLUMN "keywords" TEXT NOT NULL DEFAULT '';
