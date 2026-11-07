"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { setUnit } from "@/app/(app)/unit-actions";
import { NAV_START_EVENT, NAV_END_EVENT } from "./NavProgress";

import { SIDEBAR_COOKIE } from "@/lib/prefs";
import { ThemeToggle } from "./ThemeToggle";
import {
  LayoutDashboard, ClipboardMinus, PackagePlus, ShoppingCart, Receipt, Boxes, ArrowLeftRight, ClipboardCheck,
  BarChart3, PieChart, Pill, Truck, Tags, Building2, Users, Settings, LogOut, ChevronsLeft, ChevronsRight, Menu, X, Package,
  type LucideIcon,
} from "lucide-react";

type NavGroup = { title: string; links: { href: string; label: string; icon: LucideIcon; admin?: boolean }[] };

export const NAV: NavGroup[] = [
  { title: "", links: [{ href: "/", label: "首頁", icon: LayoutDashboard }] },
  {
    title: "日常作業",
    links: [
      { href: "/consumption", label: "耗用登記", icon: ClipboardMinus },
      { href: "/receipts", label: "進貨單", icon: PackagePlus },
      { href: "/purchase-list", label: "待採購清單", icon: ShoppingCart },
      { href: "/invoices", label: "發票", icon: Receipt },
    ],
  },
  {
    title: "庫存",
    links: [
      { href: "/stock", label: "庫存總覽", icon: Boxes },
      { href: "/transfers", label: "庫別調撥", icon: ArrowLeftRight },
      { href: "/stocktakes", label: "盤點", icon: ClipboardCheck },
    ],
  },
  { title: "報表", links: [{ href: "/analytics", label: "統計分析", icon: PieChart }, { href: "/reports", label: "報表", icon: BarChart3 }] },
  {
    title: "主檔",
    links: [
      { href: "/items", label: "品項", icon: Pill },
      { href: "/suppliers", label: "供應商", icon: Truck },
      { href: "/categories", label: "類別", icon: Tags },
      { href: "/warehouses", label: "庫別（部門）", icon: Building2 },
    ],
  },
  {
    title: "系統",
    links: [
      { href: "/users", label: "使用者", icon: Users, admin: true },
      { href: "/settings", label: "系統設定", icon: Settings, admin: true },
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
      // The action's reply already carries this page redrawn for the new unit.
      await setUnit(v);
      // Only when the page has its own filters in the address, drop them so it shows the new unit.
      if (location.search) router.replace(path);
    });
  }
  // The address may not change, so tell the top bar the switch is done.
  const wasSwitching = useRef(false);
  useEffect(() => {
    if (wasSwitching.current && !switching) window.dispatchEvent(new Event(NAV_END_EVENT));
    wasSwitching.current = switching;
  }, [switching]);
  const unitSelect = (
    <select
      value={unit ?? "all"}
      disabled={switching}
      onChange={(e) => switchUnit(e.target.value)}
      aria-label="目前單位"
      className="select-plain w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-3 text-sm font-medium text-slate-800 hover:border-slate-300 focus:border-teal-500 focus:outline-none focus:ring-3 focus:ring-teal-500/15"
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

  const brand = (
    <Link href="/" title="回首頁" className="flex min-w-0 items-center gap-2.5 rounded-lg" onClick={() => setOpen(false)}>
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-sm shadow-teal-900/20">
        <Package className="size-5" strokeWidth={2.2} />
      </span>
      {!collapsed && (
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[15px] font-semibold text-slate-900">{clinicName}</span>
          <span className="block text-xs text-slate-500">庫存管理系統</span>
        </span>
      )}
    </Link>
  );

  return (
    <>
      {/* Phone: a slim top bar with the brand and a menu button */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur md:hidden">
        <Link href="/" className="flex items-center gap-2" onClick={() => setOpen(false)}>
          <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-600 text-white"><Package className="size-4" /></span>
          <span className="font-semibold text-slate-900">{clinicName}</span>
          <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700">{unitName}</span>
        </Link>
        <button onClick={() => setOpen(!open)} aria-label="選單" className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">
          {open ? <X className="size-5" /> : <Menu className="size-5" />}
        </button>
      </div>
      <aside
        className={`${open ? "flex" : "hidden"} w-full shrink-0 flex-col border-r border-slate-200 bg-white md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto ${
          collapsed ? "md:w-[72px]" : "md:w-60"
        }`}
      >
        <div className={`hidden items-center gap-2 pb-4 pt-5 md:flex ${collapsed ? "flex-col px-2" : "justify-between px-4"}`}>
          {brand}
          <button
            onClick={toggle}
            title={collapsed ? "展開側邊欄" : "收合側邊欄"}
            aria-label={collapsed ? "展開側邊欄" : "收合側邊欄"}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            {collapsed ? <ChevronsRight className="size-4" /> : <ChevronsLeft className="size-4" />}
          </button>
        </div>
        <div className={`px-4 pb-4 pt-3 md:pt-0 ${collapsed ? "md:hidden" : ""}`}>
          <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-slate-500"><Building2 className="size-3.5" />目前單位</div>
          {unitSelect}
        </div>
        {collapsed && (
          <div className="hidden px-1 pb-3 text-center md:block" title={`目前單位：${unitName}（展開側邊欄可切換）`}>
            <span className="inline-block rounded-md bg-teal-50 px-1.5 py-0.5 text-xs font-medium text-teal-700">{unitName?.slice(0, 2)}</span>
          </div>
        )}
        <nav className={`flex-1 pb-4 ${collapsed ? "px-3 md:px-2" : "px-3"}`}>
          {NAV.map((g) => {
            const links = g.links.filter((l) => !l.admin || isAdmin);
            if (links.length === 0) return null;
            return (
              <div key={g.title} className="mb-3">
                {g.title && (
                  <div className={`px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-slate-400 ${collapsed ? "md:hidden" : ""}`}>{g.title}</div>
                )}
                {g.title && collapsed && <div className="mx-2 mb-2 hidden border-t border-slate-100 md:block" />}
                <div className="space-y-0.5">
                  {links.map((l) => {
                    const on = active(l.href);
                    const Icon = l.icon;
                    return (
                      <Link
                        key={l.href}
                        href={l.href}
                        title={l.label}
                        onClick={() => {
                          setOpen(false);
                          if (!matches(l.href, path)) setClicked(l.href);
                        }}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-[7px] text-sm transition-colors ${collapsed ? "md:justify-center md:px-0" : ""} ${
                          on ? "bg-teal-50 font-semibold text-teal-800" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                        }`}
                      >
                        {on && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r-full bg-teal-600" />}
                        <Icon className={`size-[18px] shrink-0 ${on ? "text-teal-600" : "text-slate-400 group-hover:text-slate-600"}`} strokeWidth={on ? 2.2 : 1.9} />
                        <span className={collapsed ? "md:hidden" : ""}>{l.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className={`border-t border-slate-200 p-3 ${collapsed ? "md:px-2" : ""}`}>
          <div className={`flex items-center gap-2.5 ${collapsed ? "md:flex-col" : ""}`}>
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-slate-100 text-sm font-semibold text-slate-600" title={userName}>
              {userName.slice(0, 1)}
            </span>
            <div className={`min-w-0 flex-1 ${collapsed ? "md:hidden" : ""}`}>
              <div className="truncate text-sm font-medium text-slate-800">{userName}</div>
              <div className="text-xs text-slate-500">{isAdmin ? "管理員" : "使用者"}</div>
            </div>
            <ThemeToggle compact />
            <form action={logout}>
              <button title="登出" aria-label="登出" className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600">
                <LogOut className="size-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>
    </>
  );
}
