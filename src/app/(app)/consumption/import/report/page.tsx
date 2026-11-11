import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, Empty, WarehousePills } from "@/components/ui";
import { pickWarehouse, getUnit, getAccess } from "@/lib/auth";
import { activeWarehouses } from "@/lib/pickers";
import { fmtMoney, fmtQty, num } from "@/lib/format";
import { todayTaipei } from "@/lib/logic";
import { PRICE_TYPE_LABEL, type PriceType } from "@/lib/hisParse";
import { summarizeHis, COST_DIFF_LIMIT, type ItemReportRow } from "@/lib/hisReport";

const TYPE_COLOR: Record<PriceType, string> = {
  NHI: "bg-sky-50 text-sky-700 ring-sky-200",
  SELF: "bg-violet-50 text-violet-700 ring-violet-200",
  FREE: "bg-slate-100 text-slate-600 ring-slate-200",
};

const FLAG: Record<ItemReportRow["flags"][number], [string, string]> = {
  NO_COST: ["沒有進貨成本", "還沒有進貨紀錄，成本算 0。請補登進貨單或在品項填參考單價。"],
  HIS_NO_COST: ["方鼎沒有成本", "方鼎這個品項的成本是 0，以系統的進貨成本為準。"],
  COST_DIFF: ["成本差異大", `系統進貨成本和方鼎成本差超過 ${COST_DIFF_LIMIT * 100}%，可能其中一邊的價格沒有更新。`],
  LOSS: ["低於成本", "收入比成本低。"],
};

const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)}%` : "—");
const money = (n: number) => fmtMoney(Math.round(n));

export default async function HisReportPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [warehouses, unit, access] = await Promise.all([activeWarehouses(), getUnit(), getAccess()]);
  const wid = await pickWarehouse(sp.warehouse, unit);
  // 「全部庫別」 still leaves out the departments this person may not see.
  const whereWh = wid ? { warehouseId: wid } : access.hidden.length ? { warehouseId: { notIn: access.hidden } } : {};
  const today = todayTaipei();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(sp.from ?? "") ? sp.from : today.slice(0, 8) + "01";
  const to = /^\d{4}-\d{2}-\d{2}$/.test(sp.to ?? "") ? sp.to : today;

  const [lines, imports] = await Promise.all([
    prisma.hisImportLine.findMany({
      where: { import: { dateTo: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T00:00:00Z") }, ...whereWh } },
    }),
    prisma.hisImport.count({
      where: { dateTo: { gte: new Date(from + "T00:00:00Z"), lte: new Date(to + "T00:00:00Z") }, ...whereWh },
    }),
  ]);
  const itemIds = [...new Set(lines.map((l) => l.itemId).filter((x): x is number => x != null))];
  const items = new Map((await prisma.item.findMany({ where: { id: { in: itemIds } }, select: { id: true, code: true, name: true, unit: true } })).map((i) => [i.id, i]));

  const r = summarizeHis(lines.map((l) => ({
    itemId: l.itemId, hisCode: l.hisCode, hisName: l.hisName, priceType: l.priceType as PriceType,
    unitPrice: num(l.unitPrice), hisQty: num(l.hisQty), qty: num(l.qty), amount: num(l.amount), cost: num(l.cost),
    hisCost: l.hisCost == null ? null : num(l.hisCost),
  })));
  const flagged = r.items.filter((i) => i.flags.length);
  const shownFlag = sp.flag === "1";
  const rows = shownFlag ? flagged : r.items;
  const keep = { from, to, warehouse: sp.warehouse };

  return (
    <div className="space-y-5">
      <PageHeader title="HIS 耗用分析" description="依方鼎報表匯入的耗用：收入用報表的實際金額，成本用系統的進貨批次單價，並對照方鼎記錄的成本。">
        <Link href="/consumption/import" className="btn-secondary">匯入 HIS 耗用</Link>
      </PageHeader>

      <form className="card flex flex-wrap items-end gap-3">
        {sp.warehouse && <input type="hidden" name="warehouse" value={sp.warehouse} />}
        <label className="block"><span className="label">從</span><input type="date" name="from" defaultValue={from} className="input" /></label>
        <label className="block"><span className="label">到</span><input type="date" name="to" defaultValue={to} className="input" /></label>
        <button className="btn">查詢</button>
        <span className="text-sm text-slate-500">期間內共 {imports} 次匯入、{lines.length} 列。</span>
      </form>
      <WarehousePills path="/consumption/import/report" sp={keep} warehouses={warehouses} current={wid} mine={unit} />

      {lines.length === 0 ? <div className="card"><Empty>這段期間還沒有匯入 HIS 耗用</Empty></div> : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="收入（報表合計）" value={money(r.totals.revenue)} />
            <Stat label="進貨成本" value={money(r.totals.cost)} hint={`方鼎記錄的成本 ${money(r.totals.hisCost)}`} />
            <Stat label="毛利" value={money(r.totals.margin)} tone={r.totals.margin < 0 ? "bad" : "good"} />
            <Stat label="毛利率" value={pct(r.totals.margin, r.totals.revenue)} />
          </div>

          <section className="card p-0">
            <h2 className="px-5 pb-3 pt-5 font-semibold text-slate-900">依價別</h2>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>價別</th><th className="num">數量</th><th className="num">收入</th><th className="num">占收入</th><th className="num">成本</th><th className="num">毛利</th><th className="num">毛利率</th></tr></thead>
                <tbody>
                  {r.types.map((t) => (
                    <tr key={t.type}>
                      <td><span className={`badge ring-1 ring-inset ${TYPE_COLOR[t.type]}`}>{PRICE_TYPE_LABEL[t.type]}</span></td>
                      <td className="num">{fmtQty(t.qty)}</td>
                      <td className="num">{money(t.revenue)}</td>
                      <td className="num">{pct(t.revenue, r.totals.revenue)}</td>
                      <td className="num">{money(t.cost)}</td>
                      <td className={`num ${t.margin < 0 ? "text-rose-600" : ""}`}>{money(t.margin)}</td>
                      <td className="num">{t.type === "FREE" ? "—" : pct(t.margin, t.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="px-5 pb-4 pt-2 text-xs text-slate-500">價別是自動歸類：0 元＝贈送，等於健保價＝健保，其他＝自費（含優惠）。贈送沒有收入，成本照算。</p>
          </section>

          <section className="card p-0">
            <div className="flex flex-wrap items-center justify-between gap-2 px-5 pb-3 pt-5">
              <h2 className="font-semibold text-slate-900">依品項</h2>
              <div className="flex gap-1 text-sm">
                <Link href={`?${new URLSearchParams({ ...clean(keep) })}`} className={`rounded-full border px-3 py-1 ${!shownFlag ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200"}`}>全部 {r.items.length}</Link>
                <Link href={`?${new URLSearchParams({ ...clean(keep), flag: "1" })}`} className={`rounded-full border px-3 py-1 ${shownFlag ? "border-teal-600 bg-teal-600 text-white" : "border-slate-200"}`}>需要注意 {flagged.length}</Link>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>品項</th><th>報表價格</th><th className="num">扣庫數量</th><th className="num">收入</th><th className="num">進貨成本</th><th className="num">方鼎成本</th><th className="num">毛利</th><th className="num">毛利率</th><th>注意</th></tr></thead>
                <tbody>
                  {rows.map((i) => {
                    const it = i.itemId != null ? items.get(i.itemId) : undefined;
                    return (
                      <tr key={i.key}>
                        <td>
                          {it ? <Link href={`/items/${it.id}`} className="hover:underline">{it.name}</Link> : i.hisName}
                          <div className="font-mono text-[11px] text-slate-400">{i.hisCode}</div>
                        </td>
                        <td className="whitespace-nowrap text-xs">
                          {i.prices.map((p) => (
                            <span key={p.type + p.price} className={`badge mr-1 ring-1 ring-inset ${TYPE_COLOR[p.type]}`}>{PRICE_TYPE_LABEL[p.type]} {p.price.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}</span>
                          ))}
                        </td>
                        <td className="num whitespace-nowrap">{fmtQty(i.qty)} {it?.unit}</td>
                        <td className="num">{money(i.revenue)}</td>
                        <td className="num">{money(i.cost)}</td>
                        <td className="num text-slate-500">{i.hisCostTotal == null ? "—" : money(i.hisCostTotal)}</td>
                        <td className={`num ${i.margin < 0 ? "text-rose-600" : ""}`}>{money(i.margin)}</td>
                        <td className="num">{pct(i.margin, i.revenue)}</td>
                        <td className="whitespace-nowrap">
                          {i.flags.map((f) => (
                            <span key={f} title={FLAG[f][1]} className="badge mr-1 bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200">{FLAG[f][0]}</span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="px-5 pb-4 pt-2 text-xs text-slate-500">
              進貨成本：依進貨單的批次單價，先到期的先扣；還沒有進貨紀錄的品項用品項的參考單價。方鼎成本：報表上的「成本 × 用量」，只供對照。滑鼠移到「注意」標籤上可看說明。
            </p>
          </section>
        </>
      )}
    </div>
  );
}

function clean(o: Record<string, string | undefined>) {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v)) as Record<string, string>;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "bad" }) {
  return (
    <div className="card">
      <div className="text-sm text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "bad" ? "text-rose-600" : "text-slate-900"}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-400">{hint}</div>}
    </div>
  );
}
