# 診所庫存管理系統

單一診所、依部門分庫別的庫存系統：進貨（含發票與金額）、耗用登記、庫存與批號效期、盤點、調撥、報表。

## 功能

| 頁面 | 說明 |
| --- | --- |
| 首頁 | 需補貨品項、效期提醒、本月耗用與進貨金額、待入庫／待驗收、未對發票、未付金額 |
| 耗用登記 | 掃條碼或輸入料號，預設先到期先扣；可指定批號。允許負庫存，但會提示 |
| 進貨單 | 批號、效期、數量、贈品、單價、金額（使用者輸入，不自動加稅）、可直接填發票 |
| 待採購清單 | 記下要訂的品項；下單後清除，或轉成「待入庫」進貨單 |
| 驗收開關 | 系統設定可開關。開啟時進貨單先「待驗收」，驗收後才入庫 |
| 發票 | 一張進貨單一張，或月結一張對多張進貨單；記錄已付／未付 |
| 庫存總覽 | 各庫別庫存、1/2/3 個月安全量狀態、庫存金額、最近效期，可一鍵加入待採購 |
| 流水帳 | 每個品項的批號庫存與進出紀錄、結存 |
| 庫別調撥、盤點 | 部門間移轉（保留批號效期成本）；盤點完成自動產生調整紀錄 |
| 報表 | 耗用（日／週／月／季／年，數量或金額）、進貨、庫存金額、效期，皆可匯出 Excel |
| 主檔 | 品項、供應商、類別（可自訂）、庫別（部門）、使用者（管理員／一般人員） |

安全量：品項可在各庫別手動設定每月用量；沒設定時依最近 90 天（可在系統設定調整）的耗用自動計算。

## 技術

Next.js 15（App Router、Server Actions）、TypeScript、Prisma + PostgreSQL、Tailwind CSS 4。

庫存數量存在批號（Batch），每一筆變動都寫入異動紀錄（StockMovement），`source` 欄位預留給之後串接 HIS 自動扣庫。

## 本機開發

```bash
cp .env.example .env          # 填 DATABASE_URL、AUTH_SECRET、SEED_ADMIN_PASSWORD
npm install
npx prisma migrate deploy     # 建立資料表
npm run db:seed               # 建立 admin 帳號、預設庫別與類別
npm run db:demo               # （選用）載入範例資料，正式環境不要執行
npm run dev                   # http://localhost:3000
```

測試：`npm test`（庫存規則單元測試）、`npm run lint`（型別檢查）。

## 部署（雲端）

1. 建一個 PostgreSQL 資料庫（例如 Neon 或 Supabase），取得連線字串。
2. 在 Vercel 匯入這個 repo，設定環境變數 `DATABASE_URL`、`AUTH_SECRET`（一串長亂碼）。
3. 第一次部署後，在本機用正式的 `DATABASE_URL` 執行 `npx prisma migrate deploy` 與 `npm run db:seed`。
4. 用 `admin` 和 `SEED_ADMIN_PASSWORD` 登入，到「使用者」建立其他人員帳號。
