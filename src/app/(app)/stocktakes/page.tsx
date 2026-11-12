import Link from "@/components/Link";
import { prisma } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtDateTime } from "@/lib/format";
import { activeWarehouses } from "@/lib/pickers";
import { createStocktake } from "./actions";
import { getAccess, getUnit } from "@/lib/auth";

export default async function StocktakesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [list, warehouses, categories] = await Promise.all([
    prisma.stocktake.findMany({ where: { warehouseId: { notIn: (await getAccess()).hidden } }, orderBy: { id: "desc" }, take: 100 }),
    activeWarehouses(),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const [unit, access] = await Promise.all([getUnit(), getAccess()]);
  const wh = new Map(warehouses.map((w) => [w.id, w.name]));
  return (
    <div className="space-y-4">
      <PageHeader title="盤點" />
      <Flash sp={sp} />
      <form action={createStocktake} className="card grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
        <Field label="庫別"><select name="warehouseId" defaultValue={unit} className="input">{warehouses.filter((w) => access.canWrite(w.id)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
        <Field label="類別（空白=全部）">
          <select name="categoryId" className="input"><option value="">全部</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </Field>
        <Field label="備註"><input name="note" className="input" /></Field>
        <button className="btn">開始盤點</button>
      </form>
      <div className="card overflow-x-auto p-0">
        {list.length === 0 ? <Empty>沒有盤點紀錄</Empty> : (
          <table className="table">
            <thead><tr><th>單號</th><th>庫別</th><th>建立時間</th><th>狀態</th><th>備註</th></tr></thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/stocktakes/${s.id}`} className="btn-link">{s.number}</Link></td>
                  <td>{wh.get(s.warehouseId)}</td>
                  <td>{fmtDateTime(s.date)}</td>
                  <td>{s.status === "DONE" ? `已完成 ${fmtDateTime(s.completedAt)}` : <span className="text-amber-700">盤點中</span>}</td>
                  <td className="wrap">{s.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
