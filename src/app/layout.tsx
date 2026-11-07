import type { Metadata } from "next";
import "./globals.css";
import { THEME_COOKIE } from "@/lib/prefs";

export const metadata: Metadata = {
  title: "診所庫存管理系統",
  description: "診所進貨、耗用、庫存與報表管理",
};

// Runs before the page paints, so dark mode never flashes light first.
const themeScript = `(function(){try{var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark)/);var t=m?m[1]:(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.classList.toggle('dark',t==='dark');}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant-TW" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
