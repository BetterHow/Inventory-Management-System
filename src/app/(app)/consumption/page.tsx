import { prisma } from "@/lib/db";
import { PageHeader, LinkButton, Empty, WarehousePills } from "@/components/ui";
import { requireUser, pickWarehouse } from "@/lib/auth";
import { activeWarehouses } from "@/lib/pickers";
import { Flash } from "@/components/Flash";
import { fmtDateTime, fmtMoney, fmtQty, num } from "@/lib/format";

export default async function ConsumptionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [user, warehouses] = await Promise.all([requireUser(), activeWarehouses()]);
  const wid = pickWarehouse(sp.warehouse, user);
  const moves = await prisma.stockMovement.findMany({
    where: { type: "CONSUME", ...(wid ? { warehouseId: wid } : {}) },
    include: { item: true, warehouse: true, batch: true, user: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 200,
  });
  return (
    <div>
      <PageHeader title="耗用紀錄"><LinkButton href={wid ? `/consumption/new?warehouse=${wid}` : "/consumption/new"}>＋ 登記耗用</LinkButton></PageHeader>
      <Flash sp={sp} />
      <div className="mb-3"><WarehousePills path="/consumption" sp={sp} warehouses={warehouses} current={wid} mine={user.defaultWarehouseId} /></div>
      <div className="card overflow-x-auto p-0">
        {moves.length === 0 ? <Empty>還沒有耗用紀錄</Empty> : (
          <table className="table">
            <thead><tr><th>時間</th>{!wid && <th>庫別</th>}<th>品項</th><th>批號</th><th className="num">數量</th><th className="num">成本</th><th>登記人</th><th>備註</th></tr></thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap">{fmtDateTime(m.date)}</td>
                  {!wid && <td>{m.warehouse.name}</td>}
                  <td>{m.item.name}</td>
                  <td>{m.batch?.lotNo}</td>
                  <td className="num">{fmtQty(-num(m.qty))} {m.item.unit}</td>
                  <td className="num">{fmtMoney(-num(m.qty) * num(m.unitCost))}</td>
                  <td>{m.user?.name}</td>
                  <td className="wrap">{m.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">顯示最近 200 筆。完整統計請看「報表」。</p>
    </div>
  );
}
