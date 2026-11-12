import Link from "@/components/Link";
import { prisma } from "@/lib/db";
import { PageHeader, Empty, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtDateTime, fmtQty, num } from "@/lib/format";
import { activeWarehouses, pickItems, itemsByWarehouse, ownerVisible } from "@/lib/pickers";
import { getAccess, getUnit } from "@/lib/auth";
import { ItemPicker } from "@/components/ItemPicker";
import { addEntry, addSuggestions, bulkAction, deleteEntry } from "./actions";
import { reorderSuggestions } from "@/lib/reorder";

export default async function PurchaseListPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [unit, access] = await Promise.all([getUnit(), getAccess()]);
  const [entries, items, suppliers, warehouses, ordered, picks, byWh] = await Promise.all([
    prisma.purchaseListEntry.findMany({ where: { status: "PENDING", ...(unit ? { warehouseId: unit } : {}) }, orderBy: { createdAt: "asc" } }),
    prisma.item.findMany({ where: { active: true }, orderBy: { code: "asc" } }),
    prisma.supplier.findMany({ where: { active: true, ...(await ownerVisible()) }, orderBy: { name: "asc" } }),
    activeWarehouses(),
    prisma.receipt.findMany({ where: { status: "ORDERED", ...(unit ? { warehouseId: unit } : {}) }, include: { supplier: true }, orderBy: { date: "desc" } }),
    pickItems(),
    itemsByWarehouse(),
  ]);
  const suggestions = await reorderSuggestions(unit ? [unit] : warehouses.map((w) => w.id));
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const whMap = new Map(warehouses.map((w) => [w.id, w.name]));

  return (
    <div className="space-y-4">
      <PageHeader title="待採購清單" />
      <p className="text-sm text-slate-500">
        記下要訂的東西。下單後轉成「待入庫」進貨單，到貨時再填批號效期入庫；不需要的直接刪除。
        {unit && <>目前只顯示「{whMap.get(unit)}」的項目，要看全部請在左上角切換成「全部單位」。</>}
      </p>
      <Flash sp={sp} />

      {suggestions.length > 0 && (
        <form action={addSuggestions} className="card p-0">
          <details open={entries.length === 0}>
            <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-5 py-3.5">
              <span className="font-semibold text-slate-900">補貨建議 <span className="badge ml-1 bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200">{suggestions.length} 項</span></span>
              <span className="text-xs text-slate-500">庫存不到 1 個月用量的品項，建議補到 3 個月（已扣掉清單上和已下單未到貨的數量）</span>
            </summary>
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="table">
                <thead><tr><th></th><th>品項</th>{!unit && <th>庫別</th>}<th className="num">庫存</th><th className="num">每月用量</th><th className="num">已在途</th><th className="num">建議數量</th><th>預設供應商</th></tr></thead>
                <tbody>
                  {suggestions.map((s) => {
                    const k = `${s.warehouseId}:${s.itemId}`;
                    return (
                      <tr key={k}>
                        <td className="w-8"><input type="checkbox" name="s" value={k} defaultChecked /></td>
                        <td><Link href={`/stock/${s.itemId}?warehouse=${s.warehouseId}`} className="font-medium text-slate-800 hover:text-teal-700">{s.name}</Link> <span className="text-xs text-slate-400">{s.code}</span></td>
                        {!unit && <td>{whMap.get(s.warehouseId)}</td>}
                        <td className={`num ${s.stock < 0 ? "font-semibold text-rose-600" : ""}`}>{fmtQty(s.stock)} {s.unit}</td>
                        <td className="num">{fmtQty(s.monthlyUsage)}</td>
                        <td className="num text-slate-500">{s.onOrder ? fmtQty(s.onOrder) : ""}</td>
                        <td className="num"><input name={`q:${k}`} type="number" step="0.01" min="0" defaultValue={s.suggest} className="input ml-auto w-24 py-1 text-right" /></td>
                        <td>{suppliers.find((x) => x.id === s.supplierId)?.name ?? <span className="text-xs text-slate-400">未設定</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-slate-100 p-3"><button className="btn">勾選的加入待採購清單</button></div>
          </details>
        </form>
      )}

      <form action={addEntry} className="card grid grid-cols-2 items-end gap-3 sm:grid-cols-6">
        <Field label="品項（掃碼或輸入）" className="col-span-2">
          <ItemPicker name="item" items={picks} itemsByWh={byWh} required />
        </Field>
        <Field label="數量"><input name="qty" type="number" step="0.01" className="input" required /></Field>
        <Field label="庫別">
          <select name="warehouseId" defaultValue={unit} className="input">{warehouses.filter((w) => access.canWrite(w.id)).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}</select>
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
        {entries.length === 0 ? <Empty>{unit ? `${whMap.get(unit)}的清單是空的` : "清單是空的"}</Empty> : (
          <>
            <table className="table">
              <thead><tr><th></th><th>品項</th>{!unit && <th>庫別</th>}<th className="num">數量</th><th>供應商</th><th>加入時間</th><th></th></tr></thead>
              <tbody>
                {entries.map((e) => {
                  const it = itemMap.get(e.itemId);
                  return (
                    <tr key={e.id}>
                      <td className="w-8"><input type="checkbox" name="ids" value={e.id} defaultChecked /></td>
                      <td>{it?.name} <span className="text-xs text-slate-400">{it?.code}</span></td>
                      {!unit && <td>{whMap.get(e.warehouseId)}</td>}
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
