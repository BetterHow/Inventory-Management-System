import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { HisImport } from "@/components/HisImport";
import { activeWarehouses } from "@/lib/pickers";
import { getAccess, getUnit } from "@/lib/auth";
import { todayTaipei } from "@/lib/logic";
import { fmtDateTime, fmtMoney, num } from "@/lib/format";
import { undoImport } from "./actions";

export default async function HisImportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [warehouses, unit, recent] = await Promise.all([
    activeWarehouses(),
    getUnit(),
    prisma.hisImport.findMany({ where: { warehouseId: { notIn: (await getAccess()).hidden } }, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const access = await getAccess();
  const whName = new Map(warehouses.map((w) => [w.id, w.name]));
  return (
    <div className="space-y-6">
      <PageHeader title="匯入 HIS 耗用" description="上傳方鼎每日「藥品耗用統計表」，自動扣庫、記錄實收金額與價別。">
        <Link href="/consumption" className="btn-secondary">回耗用紀錄</Link>
      </PageHeader>
      <Flash sp={sp} />
      <HisImport warehouses={warehouses.filter((w) => access.canWrite(w.id))} defaultWarehouseId={unit} today={todayTaipei()} />
      <section className="card p-0">
        <h2 className="px-5 pb-3 pt-5 font-semibold text-slate-900">最近匯入</h2>
        {recent.length === 0 ? <Empty>還沒有匯入紀錄</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>報表期間</th><th>庫別</th><th>檔案</th><th className="num">列數</th><th className="num">收入</th><th className="num">成本</th><th className="num">毛利率</th><th>匯入時間</th><th></th></tr></thead>
              <tbody>
                {recent.map((r) => {
                  const f = r.dateFrom.toISOString().slice(0, 10), t = r.dateTo.toISOString().slice(0, 10);
                  const rev = num(r.revenue), cost = num(r.cost);
                  return (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap">{f === t ? f : `${f}～${t}`}</td>
                      <td>{whName.get(r.warehouseId)}</td>
                      <td className="max-w-[12rem] truncate">{r.fileName ?? "貼上文字"}</td>
                      <td className="num">{r.rowCount}</td>
                      <td className="num">{fmtMoney(rev)}</td>
                      <td className="num">{fmtMoney(Math.round(cost))}</td>
                      <td className="num">{rev ? `${(((rev - cost) / rev) * 100).toFixed(1)}%` : "—"}</td>
                      <td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                      <td className="text-right">
                        <form action={undoImport}>
                          <input type="hidden" name="id" value={r.id} />
                          <button className="btn-link text-rose-600">撤銷</button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
