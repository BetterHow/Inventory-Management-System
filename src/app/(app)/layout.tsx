import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import { SIDEBAR_COOKIE } from "@/lib/prefs";
import { Suspense } from "react";
import { NavProgress } from "@/components/NavProgress";
import { getUnit } from "@/lib/auth";
import { activeWarehouses } from "@/lib/pickers";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logout } from "../login/actions";
import { TopBar } from "@/components/TopBar";
import { taipeiParts } from "@/lib/logic";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, settings, store, unit, warehouses] = await Promise.all([requireUser(), getSettings(), cookies(), getUnit(), activeWarehouses()]);
  const collapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";
  const t = taipeiParts(new Date());
  const today = `${t.y}年${t.m}月${t.d}日 星期${"日一二三四五六"[t.dow]}`;
  return (
    <div className="md:flex">
      <Suspense fallback={null}><NavProgress /></Suspense>
      <Sidebar userName={user.name} isAdmin={user.role === "ADMIN"} clinicName={settings.clinicName} logout={logout} initialCollapsed={collapsed}
        unit={unit ?? null} units={warehouses.map((w) => ({ id: w.id, name: w.name }))} />
      {/* keyed by unit so a half-filled form starts over with the new unit's defaults */}
      <main key={unit ?? "all"} className="min-w-0 flex-1 px-4 py-5 md:px-8 md:py-6">
        <div className="mx-auto max-w-[1400px]">
          <TopBar today={today} />
          {children}
        </div>
      </main>
    </div>
  );
}
