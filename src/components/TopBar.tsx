"use client";
import Link from "@/components/Link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { NAV } from "./Sidebar";

const SUB: Record<string, string> = { new: "新增", edit: "編輯", prices: "健保價更新" };

/** Top strip on every page: a breadcrumb that always starts with 首頁, plus today's date. */
export function TopBar({ today }: { today: string }) {
  const path = usePathname();
  const links = NAV.flatMap((g) => g.links);
  const parts = path.split("/").filter(Boolean);
  const section = parts.length ? links.find((l) => l.href === "/" + parts[0]) : undefined;
  const crumbs: { href?: string; label: string }[] = [];
  if (section) {
    crumbs.push({ href: parts.length > 1 ? section.href : undefined, label: section.label });
    const rest = parts.slice(1);
    rest.forEach((p, i) => {
      const label = SUB[p] ?? (/^\d+$/.test(p) ? "明細" : null);
      if (!label) return;
      const last = i === rest.length - 1;
      crumbs.push({ href: last ? undefined : "/" + parts.slice(0, i + 2).join("/"), label });
    });
  }
  const home = path === "/";
  return (
    <div className="mb-5 hidden items-center justify-between gap-4 md:flex">
      <nav aria-label="目前位置" className="-ml-2 flex min-w-0 items-center gap-1 text-sm">
        <Link href="/" className={`flex items-center gap-1.5 rounded-md px-2 py-1 ${home ? "font-medium text-teal-700" : "text-slate-500 hover:bg-white hover:text-teal-700"}`}>
          <Home className="size-4" />首頁
        </Link>
        {crumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight className="size-3.5 text-slate-300" />
            {c.href ? (
              <Link href={c.href} className="rounded-md px-2 py-1 text-slate-500 hover:bg-white hover:text-teal-700">{c.label}</Link>
            ) : (
              <span className="px-2 py-1 font-medium text-slate-800">{c.label}</span>
            )}
          </span>
        ))}
      </nav>
      <div className="shrink-0 text-xs text-slate-400">{today}</div>
    </div>
  );
}
