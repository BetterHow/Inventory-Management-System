"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { setUnit } from "@/app/(app)/unit-actions";
import { NAV_START_EVENT } from "./NavProgress";

import { SIDEBAR_COOKIE } from "@/lib/prefs";

type NavGroup = { title: string; links: { href: string; label: string; short: string; admin?: boolean }[] };

const NAV: NavGroup[] = [
  { title: "", links: [{ href: "/", label: "首頁", short: "首" }] },
  {
    title: "日常作業",
    links: [
      { href: "/consumption", label: "耗用登記", short: "耗" },
      { href: "/receipts", label: "進貨單", short: "進" },
      { href: "/purchase-list", label: "待採購清單", short: "採" },
      { href: "/invoices", label: "發票", short: "票" },
    ],
  },
  {
    title: "庫存",
    links: [
      { href: "/stock", label: "庫存總覽", short: "存" },
      { href: "/transfers", label: "庫別調撥", short: "調" },
      { href: "/stocktakes", label: "盤點", short: "盤" },
    ],
  },
  { title: "報表", links: [{ href: "/reports", label: "報表", short: "報" }] },
  {
    title: "主檔",
    links: [
      { href: "/items", label: "品項", short: "品" },
      { href: "/suppliers", label: "供應商", short: "供" },
      { href: "/categories", label: "類別", short: "類" },
      { href: "/warehouses", label: "庫別（部門）", short: "部" },
    ],
  },
  {
    title: "系統",
    links: [
      { href: "/users", label: "使用者", short: "人", admin: true },
      { href: "/settings", label: "系統設定", short: "設", admin: true },
    ],
  },
];

export default function Sidebar({ userName, isAdmin, clinicName, logout, initialCollapsed = false, unit, units }: {
  unit: number | null;
  units: { id: number; name: string }[];
  initialCollapsed?: boolean;
  userName: string;
  isAdmin: boolean;
  clinicName: string;
  logout: () => Promise<void>;
}) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const [switching, startSwitch] = useTransition();
  const unitName = unit ? units.find((u) => u.id === unit)?.name : "全部單位";
  function switchUnit(v: string) {
    window.dispatchEvent(new Event(NAV_START_EVENT));
    startSwitch(async () => {
      await setUnit(v);
      // Drop this page's own filters so it shows the new unit.
      router.replace(path);
    });
  }
  const unitSelect = (
    <select
      value={unit ?? "all"}
      disabled={switching}
      onChange={(e) => switchUnit(e.target.value)}
      aria-label="目前單位"
      className="w-full rounded-md border border-slate-600 bg-slate-700 px-2 py-1.5 text-sm text-white focus:border-teal-400 focus:outline-none"
    >
      {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
      <option value="all">全部單位</option>
    </select>
  );
  // Desktop only: fold the sidebar into a narrow strip. Remembered in a cookie so it stays folded.
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  }
  // Highlight the clicked item right away, before the next page has finished loading.
  const [clicked, setClicked] = useState<string | null>(null);
  useEffect(() => setClicked(null), [path]);
  const matches = (href: string, p: string) => (href === "/" ? p === "/" : p.startsWith(href));
  const active = (href: string) => (clicked ? clicked === href : matches(href, path));

  return (
    <>
      <div className="flex items-center justify-between bg-teal-700 px-4 py-3 text-white md:hidden">
        <span className="font-semibold">{clinicName} 庫存管理 <span className="text-sm font-normal text-teal-100">· {unitName}</span></span>
        <button onClick={() => setOpen(!open)} className="rounded border border-white/40 px-2 py-0.5 text-sm">
          選單
        </button>
      </div>
      <aside
        className={`${open ? "block" : "hidden"} w-full shrink-0 bg-slate-800 text-slate-200 md:sticky md:top-0 md:block md:h-screen md:overflow-y-auto ${
          collapsed ? "md:w-16" : "md:w-56"
        }`}
      >
        <div className={`hidden items-start justify-between gap-2 py-5 md:flex ${collapsed ? "px-2" : "px-4"}`}>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-lg font-semibold text-white">{clinicName}</div>
              <div className="text-xs text-slate-400">庫存管理系統</div>
            </div>
          )}
          <button
            onClick={toggle}
            title={collapsed ? "展開側邊欄" : "收合側邊欄"}
            aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
            className={`rounded-md px-2 py-1 text-slate-400 hover:bg-slate-700 hover:text-white ${collapsed ? "mx-auto" : ""}`}
          >
            {collapsed ? "»" : "«"}
          </button>
        </div>
        <div className={`px-3 pb-4 pt-3 md:pt-0 ${collapsed ? "md:hidden" : ""}`}>
          <div className="mb-1 text-xs text-slate-400">目前單位</div>
          {unitSelect}
        </div>
        {collapsed && (
          <div className="hidden px-1 pb-3 text-center text-xs text-teal-300 md:block" title={`目前單位：${unitName}（展開側邊欄可切換）`}>
            {unitName?.slice(0, 2)}
          </div>
        )}
        <nav className={`pb-4 ${collapsed ? "px-2 md:px-1.5" : "px-2"}`}>
          {NAV.map((g) => {
            const links = g.links.filter((l) => !l.admin || isAdmin);
            if (links.length === 0) return null;
            return (
              <div key={g.title} className={`mb-3 ${collapsed ? "md:mb-2 md:border-b md:border-slate-700 md:pb-2" : ""}`}>
                {g.title && <div className={`px-2 pb-1 text-xs text-slate-400 ${collapsed ? "md:hidden" : ""}`}>{g.title}</div>}
                {links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    title={l.label}
                    onClick={() => {
                      setOpen(false);
                      if (!matches(l.href, path)) setClicked(l.href);
                    }}
                    className={`block rounded-md px-3 py-1.5 text-sm ${collapsed ? "md:px-0 md:text-center" : ""} ${
                      active(l.href) ? "bg-teal-600 text-white" : "hover:bg-slate-700"
                    }`}
                  >
                    <span className={collapsed ? "md:hidden" : ""}>{l.label}</span>
                    {collapsed && <span className="hidden md:inline">{l.short}</span>}
                  </Link>
                ))}
              </div>
            );
          })}
          <div className={`mt-6 border-t border-slate-700 px-2 pt-3 text-xs text-slate-400 ${collapsed ? "md:hidden" : ""}`}>
            <div className="mb-2">登入者：{userName}</div>
            <form action={logout}>
              <button className="text-slate-300 hover:text-white">登出</button>
            </form>
          </div>
          {collapsed && (
            <form action={logout} className="hidden text-center md:block">
              <button title={`登出（${userName}）`} className="text-xs text-slate-400 hover:text-white">登出</button>
            </form>
          )}
        </nav>
      </aside>
    </>
  );
}
