import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "診所庫存管理系統",
  description: "診所進貨、耗用、庫存與報表管理",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW">
      <body>{children}</body>
    </html>
  );
}
