import { cookies } from "next/headers";
import Sidebar from "@/components/Sidebar";
import { SIDEBAR_COOKIE } from "@/lib/prefs";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [user, settings, store] = await Promise.all([requireUser(), getSettings(), cookies()]);
  const collapsed = store.get(SIDEBAR_COOKIE)?.value === "collapsed";
  return (
    <div className="md:flex">
      <Sidebar userName={user.name} isAdmin={user.role === "ADMIN"} clinicName={settings.clinicName} logout={logout} initialCollapsed={collapsed} />
      <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
    </div>
  );
}
