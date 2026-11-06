import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";
import { UNIT_COOKIE } from "./prefs";

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
 * 目前單位: the warehouse this person is working in, chosen at the top of the sidebar.
 * Falls back to their 負責庫別. undefined = all units.
 */
export const getUnit = cache(async (): Promise<number | undefined> => {
  const user = await requireUser();
  const v = (await cookies()).get(UNIT_COOKIE)?.value;
  if (v === "all") return undefined;
  const id = Number(v) || user.defaultWarehouseId;
  if (!id) return undefined;
  const wh = await prisma.warehouse.findFirst({ where: { id, active: true }, select: { id: true } });
  return wh?.id;
});

/** Which warehouse a list page shows: "all" = every warehouse, a number = that one, nothing chosen = 目前單位. */
export function pickWarehouse(param: string | undefined, unit: number | undefined): number | undefined {
  if (param === "all") return undefined;
  if (param && Number(param) > 0) return Number(param);
  return unit;
}
