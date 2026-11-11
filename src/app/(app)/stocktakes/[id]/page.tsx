import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertRead } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { StocktakeScan } from "@/components/StocktakeScan";
import { fmtQty, num } from "@/lib/format";
import { deleteStocktake, saveCounts } from "../actions";

export default async function StocktakePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const st = await prisma.stocktake.findUnique({ where: { id: Number(id) }, include: { lines: { orderBy: { id: "asc" } } } });
  if (!st) notFound();
  await assertRead(st.warehouseId);
  const [items, wh] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: st.lines.map((l) => l.itemId) } } }),
    prisma.warehouse.findUnique({ where: { id: st.warehouseId } }),
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const done = st.status === "DONE";
  const diffs = st.lines.filter((l) => l.countedQty !== null && num(l.countedQty) !== num(l.systemQty));

  return (
    <div className="space-y-4">
      <PageHeader title={`盤點 ${st.number} · ${wh?.name}`}>
        {!done && <StocktakeScan />}
        {!done && <form action={deleteStocktake.bind(null, st.id)}><button className="btn-secondary text-rose-600">刪除</button></form>}
      </PageHeader>
      <Flash sp={sp} />
      <p className="text-sm text-slate-500">
        {done ? `已完成，共 ${diffs.length} 項有差異並已調整庫存。` : "輸入實際點到的數量，沒點的留空就不會調整。可以先暫存，全部點完再按「完成盤點」。"}
      </p>
      <form action={saveCounts.bind(null, st.id)} className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>料號</th><th>品名</th><th className="num">帳上數量</th><th className="num">實點數量</th><th className="num">差異</th></tr></thead>
          <tbody>
            {st.lines.map((l) => {
              const it = itemMap.get(l.itemId);
              const diff = l.countedQty === null ? null : num(l.countedQty) - num(l.systemQty);
              return (
                <tr key={l.id} data-name={it?.name} data-codes={[it?.barcode, it?.code, it?.nhiCode].filter(Boolean).join("|").toLowerCase()}>
                  <td>{it?.code}</td><td>{it?.name}</td>
                  <td className="num">{fmtQty(l.systemQty)} {it?.unit}</td>
                  <td className="num w-32">
                    {done ? fmtQty(l.countedQty) : (
                      <input name={`c_${l.id}`} type="number" step="0.01" defaultValue={l.countedQty === null ? "" : num(l.countedQty)} className="input num" />
                    )}
                  </td>
                  <td className={`num ${diff ? (diff < 0 ? "text-rose-600" : "text-emerald-700") : ""}`}>{diff ? fmtQty(diff) : ""}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!done && (
          <div className="flex gap-2 p-3">
            <button name="intent" value="save" className="btn-secondary">暫存</button>
            <button name="intent" value="finish" className="btn">完成盤點並調整庫存</button>
          </div>
        )}
      </form>
    </div>
  );
}
