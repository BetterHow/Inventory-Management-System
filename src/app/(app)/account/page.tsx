import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt, done } from "@/lib/action";
import { UserError, str } from "@/lib/form";
import { PageHeader, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";

async function changePassword(fd: FormData) {
  "use server";
  const user = await requireUser();
  await attempt("/account", async () => {
    const current = str(fd, "current"), next = str(fd, "next");
    if (!(await bcrypt.compare(current, user.passwordHash))) throw new UserError("目前的密碼不正確");
    if (next.length < 8) throw new UserError("新密碼至少 8 個字元");
    if (next !== str(fd, "again")) throw new UserError("兩次輸入的新密碼不一樣");
    if (next === current) throw new UserError("新密碼不能跟目前的一樣");
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  });
  return done("/account", "密碼已更新", "自己修改密碼");
}

export default async function AccountPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const [user, sp] = await Promise.all([requireUser(), searchParams]);
  return (
    <div className="max-w-md">
      <PageHeader title="我的帳號" description={`${user.name}（${user.username}）`} />
      <Flash sp={sp} />
      <form action={changePassword} className="card space-y-3">
        <h2 className="font-semibold text-slate-900">修改密碼</h2>
        <Field label="目前的密碼"><input name="current" type="password" className="input" autoComplete="current-password" required /></Field>
        <Field label="新密碼（至少 8 個字元）"><input name="next" type="password" className="input" autoComplete="new-password" minLength={8} required /></Field>
        <Field label="再輸入一次新密碼"><input name="again" type="password" className="input" autoComplete="new-password" minLength={8} required /></Field>
        <button className="btn">更新密碼</button>
        <p className="text-xs text-slate-500">忘記密碼時，請管理員在「使用者」頁面幫你重設。</p>
      </form>
    </div>
  );
}
