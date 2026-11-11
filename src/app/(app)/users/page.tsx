import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { changes } from "@/lib/audit";
import { UserError, bool, str } from "@/lib/form";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { activeWarehouses } from "@/lib/pickers";

const whVal = (fd: FormData) => (Number(fd.get("defaultWarehouseId")) > 0 ? Number(fd.get("defaultWarehouseId")) : null);

async function addUser(fd: FormData) {
  "use server";
  await requireAdmin();
  await attempt("/users", async () => {
    const username = str(fd, "username");
    const name = str(fd, "name");
    const password = str(fd, "password");
    if (!username || !name) throw new UserError("帳號與姓名必填");
    if (password.length < 8) throw new UserError("密碼至少 8 個字元");
    await prisma.user.create({
      data: { username, name, defaultWarehouseId: whVal(fd), role: str(fd, "role") === "ADMIN" ? "ADMIN" : "STAFF", passwordHash: await bcrypt.hash(password, 10) },
    });
  });
  revalidatePath("/users");
  return done("/users", "已新增使用者", `${str(fd, "username")}（${str(fd, "name")}）`);
}

async function saveUser(id: number, fd: FormData) {
  "use server";
  const me = await requireAdmin();
  let detail = "";
  await attempt("/users", async () => {
    const role = str(fd, "role") === "ADMIN" ? "ADMIN" : "STAFF";
    const active = bool(fd, "active");
    if (id === me.id && (role !== "ADMIN" || !active)) throw new UserError("不能停用自己或取消自己的管理員身分");
    const password = str(fd, "password");
    if (password && password.length < 8) throw new UserError("密碼至少 8 個字元");
    const before = await prisma.user.findUniqueOrThrow({ where: { id }, include: { access: true } });
    const after = await prisma.user.update({
      where: { id },
      data: {
        name: str(fd, "name"),
        role,
        defaultWarehouseId: whVal(fd),
        invoiceClerk: bool(fd, "invoiceClerk"),
        active,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
    // 部門權限: only restrictions are stored; 可改 = no row.
    const limits = [...fd.entries()].flatMap(([k, v]) =>
      k.startsWith("acc:") && (v === "READ" || v === "NONE") ? [{ userId: id, warehouseId: Number(k.slice(4)), level: String(v) }] : []);
    await prisma.$transaction([
      prisma.userWarehouseAccess.deleteMany({ where: { userId: id } }),
      prisma.userWarehouseAccess.createMany({ data: role === "ADMIN" ? [] : limits }),
    ]);
    const acc = (list: { warehouseId: number; level: string }[]) => list.map((a) => `${a.warehouseId}:${a.level}`).sort().join(",");
    detail = [
      after.username,
      changes(before, after, { name: "姓名", role: "角色", defaultWarehouseId: "負責庫別", invoiceClerk: "行政", active: "啟用" }),
      password ? "重設密碼" : "",
      acc(before.access) !== acc(role === "ADMIN" ? [] : limits) ? "調整部門權限" : "",
    ].filter(Boolean).join("　");
  });
  revalidatePath("/", "layout");
  return done("/users", "已修改使用者", detail);
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [users, warehouses] = await Promise.all([prisma.user.findMany({ orderBy: { id: "asc" }, include: { access: true } }), activeWarehouses()]);
  const whSelect = (v?: number | null) => (
    <select name="defaultWarehouseId" defaultValue={v ?? ""} className="input w-36" title="負責庫別：列表預設只顯示這個庫別">
      <option value="">負責庫別：全部</option>
      {warehouses.map((w) => <option key={w.id} value={w.id}>負責：{w.name}</option>)}
    </select>
  );
  return (
    <div className="max-w-4xl">
      <PageHeader title="使用者" />
      <p className="mb-3 text-sm text-slate-500">新增人員：在最下面那一列填帳號、姓名、密碼後按「新增」，把帳號密碼告訴對方即可。每個人用自己的帳號，操作紀錄才分得出是誰。「部門權限」預設全部開放，需要時再展開調整：只能看＝看得到但不能新增或修改；不開放＝完全看不到那個部門。勾選「行政」的人可以處理所有部門的發票。「負責庫別」設定後，這個人打開進貨單、耗用紀錄、庫存總覽時，會先只看到自己的庫別，新增單據也會預設這個庫別（需要時仍可切換到其他庫別）。</p>
      <Flash sp={sp} />
      <div className="card space-y-3 divide-y divide-slate-100 [&>form]:pt-3 [&>form:first-child]:pt-0">
        {users.map((u) => (
          <form key={u.id} action={saveUser.bind(null, u.id)} className="flex flex-wrap items-center gap-2">
            <span className="w-28 text-sm font-medium">{u.username}</span>
            <input name="name" defaultValue={u.name} className="input w-32" />
            <select name="role" defaultValue={u.role} className="input w-28">
              <option value="STAFF">一般人員</option>
              <option value="ADMIN">管理員</option>
            </select>
            {whSelect(u.defaultWarehouseId)}
            <input name="password" type="password" placeholder="新密碼（不改留空）" className="input w-44" autoComplete="new-password" />
            <label className="flex items-center gap-1 text-sm" title="行政：可查看與處理所有部門的發票，不受部門權限限制"><input type="checkbox" name="invoiceClerk" defaultChecked={u.invoiceClerk} /> 行政（管全部發票）</label>
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} /> 啟用</label>
            <button className="btn-secondary">儲存</button>
            {u.role === "ADMIN" ? <span className="w-full text-xs text-slate-400">部門權限：管理員可看可改全部部門</span> : (
              <details className="w-full" open={u.access.length > 0}>
                <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-800">
                  部門權限{u.access.length ? `：${u.access.length} 個部門有限制` : "：全部可看可改"}
                </summary>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 rounded-lg bg-slate-50 px-3 py-2.5">
                  {warehouses.map((w) => (
                    <label key={w.id} className="flex items-center gap-1.5 text-sm">
                      <span className="text-slate-600">{w.name}</span>
                      <select name={`acc:${w.id}`} defaultValue={u.access.find((a) => a.warehouseId === w.id)?.level ?? "WRITE"} className="input w-28 py-1 text-sm">
                        <option value="WRITE">可看可改</option>
                        <option value="READ">只能看</option>
                        <option value="NONE">不開放</option>
                      </select>
                    </label>
                  ))}
                </div>
              </details>
            )}
          </form>
        ))}
        <form action={addUser} className="flex flex-wrap items-center gap-2">
          <input name="username" placeholder="帳號" className="input w-28" />
          <input name="name" placeholder="姓名" className="input w-32" />
          <select name="role" className="input w-28">
            <option value="STAFF">一般人員</option>
            <option value="ADMIN">管理員</option>
          </select>
          {whSelect()}
          <input name="password" type="password" placeholder="密碼（至少8字元）" className="input w-44" autoComplete="new-password" />
          <button className="btn">新增</button>
        </form>
      </div>
    </div>
  );
}
