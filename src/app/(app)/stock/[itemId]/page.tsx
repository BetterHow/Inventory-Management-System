import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, ExpiryBadge, Empty } from "@/components/ui";
import { fmtDate, fmtDateTime, fmtMoney, fmtQty, num, MOVEMENT_LABEL } from "@/lib/format";
import { expiryStatus } from "@/lib/logic";
import { getSettings } from "@/lib/settings";
import { activeWarehouses } from "@/lib/pickers";

export default async function ItemStockPage({ params, searchParams }: {
  params: Promise<{ itemId: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { itemId } = await params;
  const sp = await searchParams;
  const item = await prisma.item.findUnique({ where: { id: Number(itemId) } });
  if (!item) notFound();
  const warehouses = await activeWarehouses();
  const wid = sp.warehouse ? Number(sp.warehouse) : undefined;
  const where = { itemId: item.id, ...(wid ? { warehouseId: wid } : {}) };
  const [batches, moves, settings] = await Promise.all([
    prisma.batch.findMany({ where: { ...where, NOT: { qty: 0 } }, include: { warehouse: true }, orderBy: [{ expiryDate: "asc" }] }),
    prisma.stockMovement.findMany({ where, include: { warehouse: true, batch: true, user: true }, orderBy: [{ date: "asc" }, { id: "asc" }] }),
    getSettings(),
  ]);
  // Running balance, newest first for display.
  let bal = 0;
  const ledger = moves.map((m) => ({ m, bal: (bal = Math.round((bal + num(m.qty)) * 100) / 100) })).reverse().slice(0, 300);
  const refLink = (t: string | null, id: number | null) =>
    t === "RECEIPT" && id ? `/receipts/${id}` : t === "STOCKTAKE" && id ? `/stocktakes/${id}` : null;

  return (
    <div className="space-y-4">
      <PageHeader title={`${item.name}（${item.code}）`}>
        <Link href={`/items/${item.id}`} className="btn-secondary">品項設定</Link>
      </PageHeader>
      <div className="flex flex-wrap gap-1 text-sm">
        <Link href={`/stock/${item.id}`} className={`rounded-full px-3 py-1 ${!wid ? "bg-teal-600 text-white" : "border border-slate-200 bg-white"}`}>全部庫別</Link>
        {warehouses.map((w) => (
          <Link key={w.id} href={`/stock/${item.id}?warehouse=${w.id}`} className={`rounded-full px-3 py-1 ${wid === w.id ? "bg-teal-600 text-white" : "border border-slate-200 bg-white"}`}>{w.name}</Link>
        ))}
      </div>
      <div className="space-y-4">
        <div className="card overflow-x-auto p-0 lg:max-w-3xl">
          <h2 className="px-3 pt-3 font-semibold">批號庫存</h2>
          {batches.length === 0 ? <Empty>沒有庫存</Empty> : (
            <table className="table">
              <thead><tr>{!wid && <th>庫別</th>}<th>批號</th><th>效期</th><th className="num">數量</th><th className="num">單位成本</th></tr></thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id}>
                    {!wid && <td>{b.warehouse.name}</td>}
                    <td>{b.lotNo || "—"}</td>
                    <td className="whitespace-nowrap">{fmtDate(b.expiryDate, true)} <ExpiryBadge status={expiryStatus(b.expiryDate, new Date(), settings.expiryWarnDays, settings.expiryDangerDays)} /></td>
                    <td className={`num ${num(b.qty) < 0 ? "text-rose-600" : ""}`}>{fmtQty(b.qty)}</td>
                    <td className="num">{fmtMoney(b.unitCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card overflow-x-auto p-0">
          <h2 className="px-3 pt-3 font-semibold">進出庫流水帳 <span className="text-xs font-normal text-slate-400">最近 300 筆</span></h2>
          {ledger.length === 0 ? <Empty>沒有紀錄</Empty> : (
            <table className="table">
              <thead><tr><th>時間</th><th>類型</th>{!wid && <th>庫別</th>}<th>批號</th><th className="num">異動</th><th className="num">結存</th><th>人員</th><th className="w-full">備註</th></tr></thead>
              <tbody>
                {ledger.map(({ m, bal }) => {
                  const link = refLink(m.refType, m.refId);
                  const q = num(m.qty);
                  return (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap">{fmtDateTime(m.date)}</td>
                      <td>{link ? <Link href={link} className="btn-link">{MOVEMENT_LABEL[m.type]}</Link> : MOVEMENT_LABEL[m.type]}{m.source !== "MANUAL" && <span className="text-xs text-slate-400"> {m.source}</span>}</td>
                      {!wid && <td>{m.warehouse.name}</td>}
                      <td>{m.batch?.lotNo}</td>
                      <td className={`num ${q < 0 ? "text-rose-600" : "text-emerald-700"}`}>{q > 0 ? "+" : ""}{fmtQty(q)}</td>
                      <td className={`num ${bal < 0 ? "text-rose-600" : ""}`}>{fmtQty(bal)}</td>
                      <td>{m.user?.name}</td>
                      <td className="wrap w-full text-xs text-slate-500">{m.note}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
