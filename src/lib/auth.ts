import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";

/** The signed-in user, re-checked against the database so disabled accounts lose access at once. */
export const getCurrentUser = cache(async () => {
  const store = await cookies();
  const s = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  const user = await prisma.user.findUnique({ where: { id: s.uid } });
  if (!user || !user.active) return null;
  return user;
});

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("只有管理員可以執行這個動作");
  return u;
}

/**
 * Which warehouse a list page shows: "all" = every warehouse, a number = that one,
 * nothing chosen = the user's own warehouse (負責庫別) if they have one.
 */
export function pickWarehouse(param: string | undefined, user: { defaultWarehouseId: number | null }): number | undefined {
  if (param === "all") return undefined;
  if (param && Number(param) > 0) return Number(param);
  return user.defaultWarehouseId ?? undefined;
}
