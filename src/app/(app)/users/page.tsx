import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
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
  return done("/users", "已新增使用者");
}

async function saveUser(id: number, fd: FormData) {
  "use server";
  const me = await requireAdmin();
  await attempt("/users", async () => {
    const role = str(fd, "role") === "ADMIN" ? "ADMIN" : "STAFF";
    const active = bool(fd, "active");
    if (id === me.id && (role !== "ADMIN" || !active)) throw new UserError("不能停用自己或取消自己的管理員身分");
    const password = str(fd, "password");
    if (password && password.length < 8) throw new UserError("密碼至少 8 個字元");
    await prisma.user.update({
      where: { id },
      data: {
        name: str(fd, "name"),
        role,
        defaultWarehouseId: whVal(fd),
        active,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
  });
  revalidatePath("/users");
  return done("/users", "已儲存");
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [users, warehouses] = await Promise.all([prisma.user.findMany({ orderBy: { id: "asc" } }), activeWarehouses()]);
  const whSelect = (v?: number | null) => (
    <select name="defaultWarehouseId" defaultValue={v ?? ""} className="input w-36" title="負責庫別：列表預設只顯示這個庫別">
      <option value="">負責庫別：全部</option>
      {warehouses.map((w) => <option key={w.id} value={w.id}>負責：{w.name}</option>)}
    </select>
  );
  return (
    <div className="max-w-4xl">
      <PageHeader title="使用者" />
      <p className="mb-3 text-sm text-slate-500">「負責庫別」設定後，這個人打開進貨單、耗用紀錄、庫存總覽時，會先只看到自己的庫別，新增單據也會預設這個庫別（需要時仍可切換到其他庫別）。</p>
      <Flash sp={sp} />
      <div className="card space-y-2">
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
            <label className="flex items-center gap-1 text-sm"><input type="checkbox" name="active" defaultChecked={u.active} /> 啟用</label>
            <button className="btn-secondary">儲存</button>
          </form>
        ))}
        <form action={addUser} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
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
