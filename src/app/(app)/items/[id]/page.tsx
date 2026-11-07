import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { ItemForm } from "@/components/ItemForm";
import { Flash } from "@/components/Flash";
import { num, fmtDate, fmtMoney } from "@/lib/format";
import { updateItem, saveItemSafety } from "../actions";

export default async function EditItemPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const item = await prisma.item.findUnique({ where: { id: Number(id) }, include: { settings: true, prices: { orderBy: { effectiveFrom: "desc" }, take: 20 } } });
  if (!item) notFound();
  const [categories, suppliers, warehouses] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.warehouse.findMany({ where: { active: true }, orderBy: [{ sortOrder: "asc" }, { id: "asc" }] }),
  ]);
  const manual = new Map(item.settings.map((s) => [s.warehouseId, s.manualMonthlyUsage]));

  return (
    <div className="space-y-6">
      <PageHeader title={`品項：${item.name}`}>
        <Link href={`/stock/${item.id}`} className="btn-secondary">看庫存與流水帳</Link>
      </PageHeader>
      <Flash sp={sp} />
      <ItemForm item={item} categories={categories} suppliers={suppliers} action={updateItem.bind(null, item.id)} />
      {item.prices.length > 0 && (
        <section className="card max-w-3xl p-0">
          <h2 className="px-5 pb-1 pt-5 font-semibold">健保價／售價歷史</h2>
          <p className="px-5 pb-3 text-xs text-slate-500">統計分析算價差時，每筆耗用用當天有效的價格。</p>
          <table className="table">
            <thead><tr><th>生效日</th><th className="num">價格</th><th>來源</th></tr></thead>
            <tbody>
              {item.prices.map((p) => (
                <tr key={p.id}>
                  <td>{p.effectiveFrom.getUTCFullYear() <= 2000 ? "最早（第一次設定）" : fmtDate(p.effectiveFrom, true)}</td>
                  <td className="num">{fmtMoney(p.price)}</td>
                  <td>{p.source === "NHI" ? "健保價匯入" : "手動輸入"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      <form action={saveItemSafety.bind(null, item.id)} className="card max-w-3xl">
        <h2 className="mb-1 font-semibold">安全量（每月用量）</h2>
        <p className="mb-3 text-xs text-slate-500">
          留空 = 依最近耗用自動計算。填數字 = 用你設定的每月用量判斷「不足 1/2/3 個月」。
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {warehouses.map((w) => (
            <Field key={w.id} label={w.name}>
              <input
                name={`manual_${w.id}`}
                type="number"
                step="0.01"
                className="input"
                placeholder="自動"
                defaultValue={manual.get(w.id) ? num(manual.get(w.id)) : ""}
              />
            </Field>
          ))}
        </div>
        <button className="btn mt-3">儲存安全量</button>
      </form>
    </div>
  );
}
