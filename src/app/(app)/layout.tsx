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

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, settings, store, unit, warehouses] = await Promise.all([requireUser(), getSettings(), cookies(), getUnit(), activeWarehouses()]);
  const collapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <div className="md:flex">
      <Suspense fallback={null}><NavProgress /></Suspense>
      <Sidebar userName={user.name} isAdmin={user.role === "ADMIN"} clinicName={settings.clinicName} logout={logout} initialCollapsed={collapsed}
        unit={unit ?? null} units={warehouses.map((w) => ({ id: w.id, name: w.name }))} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
