import Link from "@/components/Link";
import { prisma } from "@/lib/db";
import { PageHeader, LinkButton, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { AutoForm } from "@/components/AutoForm";
import { getUnit } from "@/lib/auth";
import { activeWarehouses, ownerVisible } from "@/lib/pickers";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [warehouses, unit, visible] = await Promise.all([activeWarehouses(), getUnit(), ownerVisible()]);
  const dept = sp.dept === "all" ? undefined : sp.dept === "shared" ? 0 : Number(sp.dept) > 0 ? Number(sp.dept) : unit;
  const q = sp.q?.trim();
  const [suppliers, catRows] = await Promise.all([
    prisma.supplier.findMany({
      where: {
        AND: [visible, dept === undefined ? {} : dept === 0 ? { ownerWarehouseId: null } : { OR: [{ ownerWarehouseId: dept }, { ownerWarehouseId: null }] }],
        ...(sp.cat ? { category: sp.cat } : {}),
        ...(q ? { OR: ["name", "taxId", "contact", "phone"].map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) } : {}),
      },
      orderBy: [{ active: "desc" }, { category: "asc" }, { name: "asc" }],
    }),
    prisma.supplier.findMany({ where: { category: { not: null }, ...visible }, distinct: ["category"], select: { category: true } }),
  ]);
  const cats = catRows.map((c) => c.category!).sort();
  const whName = new Map(warehouses.map((w) => [w.id, w.name]));
  return (
    <div>
      <PageHeader title="供應商"><LinkButton href="/suppliers/new">＋ 新增供應商</LinkButton></PageHeader>
      <Flash sp={sp} />
      <AutoForm className="mb-4 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={q} placeholder="搜尋名稱、統編、聯絡人、電話" className="input max-w-xs" />
        <select name="cat" defaultValue={sp.cat ?? ""} className="input max-w-[10rem]">
          <option value="">全部分類</option>
          {cats.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select name="dept" defaultValue={dept === undefined ? "all" : dept === 0 ? "shared" : String(dept)} className="input max-w-[12rem]" title="依所屬部門篩選">
          <option value="all">全部部門</option>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}＋共用</option>)}
          <option value="shared">只看共用</option>
        </select>
      </AutoForm>
      <div className="card overflow-x-auto p-0">
        {suppliers.length === 0 ? <Empty>沒有符合的供應商</Empty> : (
          <table className="table">
            <thead><tr><th>名稱</th><th>分類</th><th>所屬部門</th><th>統編</th><th>聯絡人</th><th>電話</th><th>付款條件</th><th>狀態</th></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/suppliers/${s.id}`} className="btn-link">{s.name}</Link></td>
                  <td>{s.category && <span className="badge bg-slate-100 text-slate-600">{s.category}</span>}</td>
                  <td>{s.ownerWarehouseId ? whName.get(s.ownerWarehouseId) ?? "" : <span className="text-slate-400">共用</span>}</td>
                  <td>{s.taxId}</td><td>{s.contact}</td><td>{s.phone}</td><td>{s.paymentTerms}</td>
                  <td>{s.active ? "" : <span className="badge bg-slate-200">停用</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">共 {suppliers.length} 家。所屬部門的供應商由該部門維護；「共用」的大家都能修改。</p>
    </div>
  );
}
