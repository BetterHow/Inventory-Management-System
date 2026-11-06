"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavGroup = { title: string; links: { href: string; label: string; admin?: boolean }[] };

const NAV: NavGroup[] = [
  { title: "", links: [{ href: "/", label: "首頁" }] },
  {
    title: "日常作業",
    links: [
      { href: "/consumption", label: "耗用登記" },
      { href: "/receipts", label: "進貨單" },
      { href: "/purchase-list", label: "待採購清單" },
      { href: "/invoices", label: "發票" },
    ],
  },
  {
    title: "庫存",
    links: [
      { href: "/stock", label: "庫存總覽" },
      { href: "/transfers", label: "庫別調撥" },
      { href: "/stocktakes", label: "盤點" },
    ],
  },
  { title: "報表", links: [{ href: "/reports", label: "報表" }] },
  {
    title: "主檔",
    links: [
      { href: "/items", label: "品項" },
      { href: "/suppliers", label: "供應商" },
      { href: "/categories", label: "類別" },
      { href: "/warehouses", label: "庫別（部門）" },
    ],
  },
  {
    title: "系統",
    links: [
      { href: "/users", label: "使用者", admin: true },
      { href: "/settings", label: "系統設定", admin: true },
    ],
  },
];

export default function Sidebar({ userName, isAdmin, clinicName, logout }: {
  userName: string;
  isAdmin: boolean;
  clinicName: string;
  logout: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <>
      <div className="flex items-center justify-between bg-teal-700 px-4 py-3 text-white md:hidden">
        <span className="font-semibold">{clinicName} 庫存管理</span>
        <button onClick={() => setOpen(!open)} className="rounded border border-white/40 px-2 py-0.5 text-sm">
          選單
        </button>
      </div>
      <aside
        className={`${open ? "block" : "hidden"} w-full shrink-0 bg-slate-800 text-slate-200 md:block md:min-h-screen md:w-56`}
      >
        <div className="hidden px-4 py-5 md:block">
          <div className="text-lg font-semibold text-white">{clinicName}</div>
          <div className="text-xs text-slate-400">庫存管理系統</div>
        </div>
        <nav className="px-2 pb-4">
          {NAV.map((g) => {
            const links = g.links.filter((l) => !l.admin || isAdmin);
            if (links.length === 0) return null;
            return (
              <div key={g.title} className="mb-3">
                {g.title && <div className="px-2 pb-1 text-xs text-slate-400">{g.title}</div>}
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className={`block rounded-md px-3 py-1.5 text-sm ${
                      active(l.href) ? "bg-teal-600 text-white" : "hover:bg-slate-700"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            );
          })}
          <div className="mt-6 border-t border-slate-700 px-2 pt-3 text-xs text-slate-400">
            <div className="mb-2">登入者：{userName}</div>
            <form action={logout}>
              <button className="text-slate-300 hover:text-white">登出</button>
            </form>
          </div>
        </nav>
      </aside>
    </>
  );
}
