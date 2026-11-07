import { prisma } from "@/lib/db";
import { PageHeader, LinkButton, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtDateTime, fmtQty, num } from "@/lib/format";

export default async function TransfersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const transfers = await prisma.transfer.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: 100 });
  const [warehouses, moves] = await Promise.all([
    prisma.warehouse.findMany(),
    prisma.stockMovement.findMany({
      where: { refType: "TRANSFER", type: "TRANSFER_OUT", refId: { in: transfers.map((t) => t.id) } },
      include: { item: true },
    }),
  ]);
  const wh = new Map(warehouses.map((w) => [w.id, w.name]));
  return (
    <div>
      <PageHeader title="庫別調撥"><LinkButton href="/transfers/new">＋ 新增調撥</LinkButton></PageHeader>
      <Flash sp={sp} />
      <div className="card overflow-x-auto p-0">
        {transfers.length === 0 ? <Empty>沒有調撥紀錄</Empty> : (
          <table className="table">
            <thead><tr><th>單號</th><th>時間</th><th>調出</th><th>調入</th><th>品項</th><th>備註</th></tr></thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>{t.number}</td>
                  <td className="whitespace-nowrap">{fmtDateTime(t.date)}</td>
                  <td>{wh.get(t.fromWarehouseId)}</td>
                  <td>{wh.get(t.toWarehouseId)}</td>
                  <td className="text-xs">
                    {moves.filter((m) => m.refId === t.id).map((m) => `${m.item.name} ×${fmtQty(-num(m.qty))}`).join("、")}
                  </td>
                  <td className="wrap">{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
