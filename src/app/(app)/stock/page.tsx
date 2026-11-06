import Link from "next/link";
import { PageHeader, SafetyBadge, ExpiryBadge, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { stockOverview } from "@/lib/overview";
import { activeWarehouses } from "@/lib/pickers";
import { fmtDate, fmtMoney, fmtQty } from "@/lib/format";
import { SAFETY_LABEL, sum, type SafetyStatus } from "@/lib/logic";
import { addEntry } from "../purchase-list/actions";

const FILTERS: SafetyStatus[] = ["NEGATIVE", "LT1", "LT2", "LT3", "OK", "NONE"];

export default async function StockPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const warehouses = await activeWarehouses();
  const wid = sp.warehouse === "all" ? undefined : Number(sp.warehouse ?? warehouses[0]?.id);
  const all = await stockOverview(wid);
  const q = (sp.q ?? "").toLowerCase();
  const status = sp.status as SafetyStatus | undefined;
  const rows = all.filter(
    (r) => (!status || r.status === status) && (!q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)),
  );
  const counts = Object.fromEntries(FILTERS.map((f) => [f, all.filter((r) => r.status === f).length]));
  const base = (extra: Record<string, string>) =>
    "/stock?" + new URLSearchParams({ warehouse: sp.warehouse ?? String(wid ?? "all"), ...(sp.q ? { q: sp.q } : {}), ...extra });
  const here = base(status ? { status } : {});

  return (
    <div>
      <PageHeader title="庫存總覽" />
      <Flash sp={sp} />
      <form className="mb-3 flex flex-wrap gap-2">
        <select name="warehouse" defaultValue={sp.warehouse ?? String(wid)} className="input max-w-[12rem]">
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          <option value="all">全部庫別合計</option>
        </select>
        <input name="q" defaultValue={sp.q} placeholder="搜尋料號或品名" className="input max-w-xs" />
        {status && <input type="hidden" name="status" value={status} />}
        <button className="btn-secondary">查詢</button>
      </form>
      <div className="mb-3 flex flex-wrap gap-1 text-sm">
        <Link href={base({})} className={`rounded-full px-3 py-1 ${!status ? "bg-teal-600 text-white" : "border border-slate-200 bg-white"}`}>全部 ({all.length})</Link>
        {FILTERS.map((f) => (
          <Link key={f} href={base({ status: f })} className={`rounded-full px-3 py-1 ${status === f ? "bg-teal-600 text-white" : "border border-slate-200 bg-white"}`}>
            {SAFETY_LABEL[f]} ({counts[f]})
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto p-0">
        {rows.length === 0 ? <Empty>沒有符合的品項</Empty> : (
          <table className="table">
            <thead>
              <tr>
                <th>料號</th><th>品名</th><th>類別</th><th className="num">庫存</th><th>狀態</th>
                <th className="num">1個月安全量</th><th className="num">2個月安全量</th><th className="num">3個月安全量</th>
                <th className="num">庫存金額</th><th>最近效期</th>{wid && <th>加入待採購</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mu = r.monthlyUsage ?? 0;
                const suggest = Math.max(0, Math.ceil(mu * 3 - r.stock));
                return (
                  <tr key={r.itemId}>
                    <td>{r.code}</td>
                    <td><Link href={`/stock/${r.itemId}${wid ? `?warehouse=${wid}` : ""}`} className="btn-link">{r.name}</Link></td>
                    <td>{r.category}</td>
                    <td className={`num ${r.stock < 0 ? "font-semibold text-rose-600" : ""}`}>{fmtQty(r.stock)} {r.unit}</td>
                    <td><SafetyBadge status={r.status} /></td>
                    <td className="num">{mu ? fmtQty(mu) : ""}{r.manual && <span className="text-xs text-slate-400"> 手動</span>}</td>
                    <td className="num">{mu ? fmtQty(mu * 2) : ""}</td>
                    <td className="num">{mu ? fmtQty(mu * 3) : ""}</td>
                    <td className="num">{fmtMoney(r.value)}</td>
                    <td className="whitespace-nowrap">{fmtDate(r.nearestExpiry, true)} <ExpiryBadge status={r.expiry} /></td>
                    {wid && (
                      <td>
                        <form action={addEntry} className="flex gap-1">
                          <input type="hidden" name="item" value={r.code} />
                          <input type="hidden" name="warehouseId" value={wid} />
                          <input type="hidden" name="back" value={here} />
                          <input name="qty" type="number" step="0.01" defaultValue={suggest || ""} className="input w-20" />
                          <button className="btn-secondary px-2">＋</button>
                        </form>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr><td colSpan={8} className="text-right font-medium">庫存金額合計</td><td className="num font-semibold">{fmtMoney(sum(rows.map((r) => r.value)))}</td><td colSpan={2}></td></tr>
            </tfoot>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">安全量 = 每月用量 × 月數。每月用量：品項有手動設定就用設定值，否則依最近耗用自動計算。建議採購量 = 3 個月用量 − 庫存。</p>
    </div>
  );
}
