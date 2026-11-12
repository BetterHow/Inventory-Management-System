import Link from "@/components/Link";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { PageHeader, Empty, Field, withParams } from "@/components/ui";
import { AutoForm } from "@/components/AutoForm";
import { AREA_NAMES } from "@/lib/audit";
import { fmtDateTime } from "@/lib/format";
import { parseTaipeiDate } from "@/lib/logic";

const PAGE = 100;

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q?.trim();
  const where = {
    ...(Number(sp.user) > 0 ? { userId: Number(sp.user) } : {}),
    ...(sp.area ? { area: sp.area } : {}),
    ...(sp.from || sp.to ? { at: { ...(sp.from ? { gte: parseTaipeiDate(sp.from) } : {}), ...(sp.to ? { lt: new Date(parseTaipeiDate(sp.to).getTime() + 86400000) } : {}) } } : {}),
    ...(q ? { OR: [{ action: { contains: q, mode: "insensitive" as const } }, { detail: { contains: q, mode: "insensitive" as const } }] } : {}),
    ...(sp.login === "1" ? {} : { NOT: { area: "登入" } }),
  };
  const [rows, total, users] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { id: "desc" }, take: PAGE, skip: (page - 1) * PAGE }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  return (
    <div>
      <PageHeader title="操作紀錄" description="誰在什麼時候新增、修改或刪除了什麼。紀錄只會增加，不能修改或刪除。" />
      <AutoForm className="card mb-4 flex flex-wrap items-end gap-3" clearHref={Object.keys(sp).length ? "/audit" : undefined}>
        <Field label="人員" className="w-36">
          <select name="user" defaultValue={sp.user ?? ""} className="input">
            <option value="">全部</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </Field>
        <Field label="功能" className="w-36">
          <select name="area" defaultValue={sp.area ?? ""} className="input">
            <option value="">全部</option>
            {AREA_NAMES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="從" className="w-40"><input type="date" name="from" defaultValue={sp.from} className="input" /></Field>
        <Field label="到" className="w-40"><input type="date" name="to" defaultValue={sp.to} className="input" /></Field>
        <Field label="關鍵字" className="w-48"><input name="q" defaultValue={sp.q} placeholder="品名、單號、發票號碼⋯" className="input" /></Field>
        <label className="flex items-center gap-1.5 pb-2 text-sm text-slate-600"><input type="checkbox" name="login" value="1" defaultChecked={sp.login === "1"} /> 顯示登入紀錄</label>
      </AutoForm>
      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? <Empty>沒有符合的紀錄</Empty> : (
          <table className="table">
            <thead><tr><th>時間</th><th>人員</th><th>功能</th><th>動作</th><th>內容</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap text-slate-500">{fmtDateTime(r.at)}</td>
                  <td className="whitespace-nowrap font-medium text-slate-800">{r.userName || "—"}</td>
                  <td><span className="badge bg-slate-100 text-slate-600">{r.area}</span></td>
                  <td className="whitespace-nowrap">{r.path && r.area !== "登入" ? <Link href={r.path} className="hover:text-teal-700">{r.action}</Link> : r.action}</td>
                  <td className="wrap min-w-[16rem] text-slate-600">{r.detail}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-slate-500">
        <span>共 {total.toLocaleString()} 筆，第 {page} / {pages} 頁</span>
        <span className="flex gap-2">
          {page > 1 && <Link href={withParams("/audit", sp, { page: String(page - 1) })} className="btn-secondary">上一頁</Link>}
          {page < pages && <Link href={withParams("/audit", sp, { page: String(page + 1) })} className="btn-secondary">下一頁</Link>}
        </span>
      </div>
    </div>
  );
}
