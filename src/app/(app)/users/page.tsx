import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { attempt } from "@/lib/action";
import { UserError, bool, str } from "@/lib/form";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";

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
      data: { username, name, role: str(fd, "role") === "ADMIN" ? "ADMIN" : "STAFF", passwordHash: await bcrypt.hash(password, 10) },
    });
  });
  revalidatePath("/users");
  redirect("/users?ok=" + encodeURIComponent("已新增使用者"));
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
        active,
        ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}),
      },
    });
  });
  revalidatePath("/users");
  redirect("/users?ok=" + encodeURIComponent("已儲存"));
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });
  return (
    <div className="max-w-4xl">
      <PageHeader title="使用者" />
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
          <input name="password" type="password" placeholder="密碼（至少8字元）" className="input w-44" autoComplete="new-password" />
          <button className="btn">新增</button>
        </form>
      </div>
    </div>
  );
}
