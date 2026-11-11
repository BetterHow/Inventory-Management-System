import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { SESSION_COOKIE, verifySession } from "./session";
import { UNIT_COOKIE } from "./prefs";
import { UserError } from "./form";

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
 * 部門權限 of the signed-in person. Only restrictions are stored, so with no rows everything is open.
 * `limited` = at least one warehouse is hidden from them; they then never get an "all warehouses" view.
 */
export const getAccess = cache(async () => {
  const user = await requireUser();
  const rows = user.role === "ADMIN" ? [] : await prisma.userWarehouseAccess.findMany({ where: { userId: user.id } });
  const hidden = rows.filter((r) => r.level === "NONE").map((r) => r.warehouseId);
  const readOnly = new Set(rows.filter((r) => r.level === "READ").map((r) => r.warehouseId));
  const none = new Set(hidden);
  return {
    // 行政 and admins handle invoices of every department.
    clerk: user.role === "ADMIN" || user.invoiceClerk,
    limited: hidden.length > 0,
    hidden,
    canRead: (id: number) => !none.has(id),
    canWrite: (id: number) => !none.has(id) && !readOnly.has(id),
  };
});

/** For server actions: stops the save when this person may not change that warehouse. */
export async function assertWrite(...warehouseIds: number[]) {
  const a = await getAccess();
  for (const id of warehouseIds) {
    if (a.canWrite(id)) continue;
    const w = await prisma.warehouse.findUnique({ where: { id }, select: { name: true } });
    throw new UserError(`您沒有修改「${w?.name ?? "這個庫別"}」的權限，請洽管理員`);
  }
}

/** Records owned by a department (品項、供應商): blank owner = shared, anyone may change it. */
export async function assertOwnerWrite(...owners: (number | null | undefined)[]) {
  await assertWrite(...owners.filter((o): o is number => !!o));
}

/** Invoices follow the departments of their receipts; 行政 and admins may handle all of them. */
export async function assertInvoiceWrite(warehouseIds: number[]) {
  if ((await getAccess()).clerk) return;
  await assertWrite(...new Set(warehouseIds));
}

/** For detail pages: a document of a hidden warehouse looks like it doesn't exist. */
export async function assertRead(...warehouseIds: number[]) {
  const a = await getAccess();
  if (!warehouseIds.some((id) => a.canRead(id))) notFound();
}

/**
 * 目前單位: the warehouse this person is working in, chosen at the top of the sidebar.
 * Falls back to their 負責庫別. undefined = all units (never for someone with hidden warehouses).
 */
export const getUnit = cache(async (): Promise<number | undefined> => {
  const [user, access] = await Promise.all([requireUser(), getAccess()]);
  const v = (await cookies()).get(UNIT_COOKIE)?.value;
  if (v === "all" && !access.limited) return undefined;
  const wanted = [Number(v) || 0, user.defaultWarehouseId ?? 0].filter((id) => id > 0 && access.canRead(id));
  if (wanted.length) {
    const found = await prisma.warehouse.findMany({ where: { id: { in: wanted }, active: true }, select: { id: true } });
    const hit = wanted.find((id) => found.some((f) => f.id === id));
    if (hit) return hit;
  }
  if (!access.limited) return undefined;
  const first = await prisma.warehouse.findFirst({ where: { active: true, id: { notIn: access.hidden } }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }], select: { id: true } });
  return first?.id ?? -1; // -1 matches nothing: every warehouse is hidden from this person
});

/** Which warehouse a list page shows: "all" = every warehouse, a number = that one, nothing chosen = 目前單位. */
export async function pickWarehouse(param: string | undefined, unit: number | undefined): Promise<number | undefined> {
  const access = await getAccess();
  if (param && Number(param) > 0 && access.canRead(Number(param))) return Number(param);
  if (param === "all" && !access.limited) return undefined;
  return unit;
}

/** Prisma filter for invoices this person may see: all for 行政／admins, else not those wholly in hidden departments. */
export async function invoiceVisible() {
  const a = await getAccess();
  if (a.clerk || !a.limited) return {};
  return { OR: [{ receipts: { none: {} } }, { receipts: { some: { warehouseId: { notIn: a.hidden } } } }] };
}
