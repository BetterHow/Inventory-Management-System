import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Empty, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtDateTime, fmtQty, num } from "@/lib/format";
import { activeWarehouses, pickItems } from "@/lib/pickers";
import { ItemPicker } from "@/components/ItemPicker";
import { addEntry, bulkAction, deleteEntry } from "./actions";

export default async function PurchaseListPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [entries, items, suppliers, warehouses, ordered, picks] = await Promise.all([
    prisma.purchaseListEntry.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } }),
    prisma.item.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    activeWarehouses(),
    prisma.receipt.findMany({ where: { status: "ORDERED" }, include: { supplier: true }, orderBy: { date: "desc" } }),
    pickItems(),
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const whMap = new Map(warehouses.map((w) => [w.id, w.name]));

  return (
    <div className="space-y-4">
      <PageHeader title="待採購清單" />
      <p className="text-sm text-slate-500">
        記下要訂的東西。下單後轉成「待入庫」進貨單，到貨時再填批號效期入庫；不需要的直接刪除。
      </p>
      <Flash sp={sp} />

      <form action={addEntry} className="card grid grid-cols-2 items-end gap-3 sm:grid-cols-6">
        <Field label="品項（掃碼或輸入）" className="col-span-2">
          <ItemPicker name="item" items={picks} required />
        </Field>
        <Field label="數量"><input name="qty" type="number" step="0.01" className="input" required /></Field>
        <Field label="庫別">
          <select name="warehouseId" className="input">{warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
        </Field>
        <Field label="供應商（空白=品項預設）">
          <select name="supplierId" className="input">
            <option value="">預設</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <button className="btn">加入</button>
      </form>

      <form action={bulkAction} className="card overflow-x-auto p-0">
        {entries.length === 0 ? <Empty>清單是空的</Empty> : (
          <>
            <table className="table">
              <thead><tr><th></th><th>品項</th><th>庫別</th><th className="num">數量</th><th>供應商</th><th>加入時間</th><th></th></tr></thead>
              <tbody>
                {entries.map((e) => {
                  const it = itemMap.get(e.itemId);
                  return (
                    <tr key={e.id}>
                      <td className="w-8"><input type="checkbox" name="ids" value={e.id} defaultChecked /></td>
                      <td>{it?.name} <span className="text-xs text-slate-400">{it?.code}</span></td>
                      <td>{whMap.get(e.warehouseId)}</td>
                      <td className="num">{fmtQty(e.qty)} {it?.unit}</td>
                      <td>{suppliers.find((s) => s.id === e.supplierId)?.name ?? <span className="text-rose-600">未指定</span>}</td>
                      <td className="text-xs text-slate-500">{fmtDateTime(e.createdAt)}</td>
                      <td className="w-16 text-right">
                        <button formAction={deleteEntry.bind(null, e.id)} formNoValidate className="btn-secondary px-2.5 py-1 text-xs text-rose-600 hover:border-rose-300 hover:bg-rose-50">刪除</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2 p-3">
              <button name="action" value="toReceipt" className="btn">勾選的轉成待入庫進貨單</button>
              <button name="action" value="clear" className="btn-secondary">刪除勾選的</button>
            </div>
          </>
        )}
      </form>

      {ordered.length > 0 && (
        <div className="card">
          <h2 className="mb-2 font-semibold">待入庫的進貨單</h2>
          <ul className="space-y-1 text-sm">
            {ordered.map((r) => (
              <li key={r.id}>
                <Link href={`/receipts/${r.id}`} className="btn-link">{r.number}</Link> · {r.supplier.name} · {num(r.totalAmount).toLocaleString()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
