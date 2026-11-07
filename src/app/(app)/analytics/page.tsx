import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Coins, Gift, PackagePlus, Percent, TrendingDown, AlertTriangle, type LucideIcon } from "lucide-react";
import { PageHeader, Pills, WarehousePills, withParams, Field, Empty } from "@/components/ui";
import { AutoForm } from "@/components/AutoForm";
import { LineChart, BarChart, RankBars } from "@/components/Charts";
import { analytics, resolvePeriod, PERIODS, NO_REVENUE } from "@/lib/analytics";
import { getUnit, pickWarehouse } from "@/lib/auth";
import { activeWarehouses } from "@/lib/pickers";
import { fmtMoney, fmtQty } from "@/lib/format";

const VIZ = { cost: "var(--viz-1)", received: "var(--viz-2)", sale: "var(--viz-3)" };
const pct = (a: number, b: number) => (b ? (a / b) * 100 : null);

function Kpi({ label, value, prev, icon: Icon, hint, goodWhenUp = true }: {
  label: string; value: number; prev: number; icon: LucideIcon; hint?: React.ReactNode; goodWhenUp?: boolean;
}) {
  const change = prev ? ((value - prev) / Math.abs(prev)) * 100 : null;
  const up = (change ?? 0) >= 0;
  const good = change === null || Math.abs(change) < 0.5 ? null : up === goodWhenUp;
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <Icon className="size-4 text-slate-400" />{label}
      </div>
      <div className="mt-1.5 text-2xl font-bold tabular-nums tracking-tight text-slate-900">{fmtMoney(Math.round(value))}</div>
      <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
        {change === null ? <span>前一期沒有資料</span> : (
          <span className={`inline-flex items-center gap-0.5 font-medium ${good === null ? "text-slate-500" : good ? "text-emerald-600" : "text-rose-600"}`}>
            {up ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
        {change !== null && <span>比前一期（{fmtMoney(Math.round(prev))}）</span>}
        {hint}
      </div>
    </div>
  );
}

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [unit, warehouses] = await Promise.all([getUnit(), activeWarehouses()]);
  const wid = pickWarehouse(sp.warehouse, unit);
  const { cur, prev } = resolvePeriod(sp);
  const a = await analytics(cur, prev, wid);
  const { totals: t, prevTotals: p } = a;
  const marginRate = pct(t.margin, t.sale);
  const unpricedCost = a.unpriced.reduce((s, r) => s + r.cost, 0);
  const whName = wid ? warehouses.find((w) => w.id === wid)?.name : "全部單位";
  const months = a.months;

  return (
    <div className="space-y-6">
      <PageHeader title="統計分析" description={<>{cur.label}・{whName}</>} />

      <div className="space-y-2">
        <WarehousePills path="/analytics" sp={sp} warehouses={warehouses} current={wid} mine={unit} />
        <div className="flex flex-wrap items-end gap-3">
          <Pills items={PERIODS.map(([k, l]) => ({ href: withParams("/analytics", { warehouse: sp.warehouse }, { period: k }), label: l, active: cur.key === k }))} />
          <AutoForm className="flex flex-wrap items-end gap-2" clearHref={cur.key === "custom" ? withParams("/analytics", { warehouse: sp.warehouse }, {}) : undefined}>
            {sp.warehouse && <input type="hidden" name="warehouse" value={sp.warehouse} />}
            <Field label="自訂期間" className="w-40"><input type="date" name="from" defaultValue={cur.key === "custom" ? cur.from : ""} className="input" /></Field>
            <Field label="到" className="w-40"><input type="date" name="to" defaultValue={cur.key === "custom" ? cur.to : ""} className="input" /></Field>
          </AutoForm>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="耗用成本" value={t.cost} prev={p.cost} icon={TrendingDown} goodWhenUp={false} />
        <Kpi label="健保價／售價金額" value={t.sale} prev={p.sale} icon={Coins} />
        <Kpi label="價差（售價 − 成本）" value={t.margin} prev={p.margin} icon={Percent}
          hint={marginRate !== null && <span className="font-medium text-slate-700">毛利率 {marginRate.toFixed(1)}%</span>} />
        <Kpi label="進貨金額" value={t.received} prev={p.received} icon={PackagePlus} goodWhenUp={false} />
        <Kpi label="贈送／損耗成本" value={t.noRevenueCost} prev={p.noRevenueCost} icon={Gift} goodWhenUp={false} />
      </div>

      {a.unpriced.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <div>
            有 <b>{a.unpriced.length}</b> 個耗用的品項還沒設定「健保價／售價」，成本 {fmtMoney(Math.round(unpricedCost))} 沒算進價差。
            到下方清單點品項就能補上。
          </div>
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-5">
        <section className="card xl:col-span-3">
          <h2 className="font-semibold text-slate-900">近 12 個月趨勢</h2>
          <p className="mb-3 text-xs text-slate-500">每月耗用成本、健保價／售價金額與進貨金額（不受上方期間影響）</p>
          <LineChart labels={months.map((m) => m.label)} series={[
            { key: "cost", label: "耗用成本", color: VIZ.cost, values: months.map((m) => m.cost) },
            { key: "received", label: "進貨金額", color: VIZ.received, values: months.map((m) => m.received) },
            { key: "sale", label: "健保價／售價金額", color: VIZ.sale, values: months.map((m) => m.sale) },
          ]} />
        </section>
        <section className="card xl:col-span-2">
          <h2 className="font-semibold text-slate-900">每月價差</h2>
          <p className="mb-3 text-xs text-slate-500">有設定售價的品項：售價金額 − 成本</p>
          <BarChart labels={months.map((m) => m.label)} values={months.map((m) => m.margin)} label="價差" pos="var(--color-teal-500)" neg="var(--color-rose-500)" height={300} width={440} />
        </section>
      </div>

      <details className="card group p-0">
        <summary className="cursor-pointer px-5 py-3 text-sm font-medium text-slate-600 hover:text-slate-900">看每月數字表</summary>
        <div className="overflow-x-auto border-t border-slate-100">
          <table className="table">
            <thead><tr><th>月份</th><th className="num">耗用成本</th><th className="num">健保價／售價金額</th><th className="num">價差</th><th className="num">進貨金額</th></tr></thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.key}><td>{m.key}</td><td className="num">{fmtMoney(Math.round(m.cost))}</td><td className="num">{fmtMoney(Math.round(m.sale))}</td>
                  <td className={`num ${m.margin < 0 ? "text-rose-600" : ""}`}>{fmtMoney(Math.round(m.margin))}</td><td className="num">{fmtMoney(Math.round(m.received))}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold text-slate-900">各類別耗用成本</h2>
          {a.categories.length === 0 ? <Empty>這段期間沒有耗用</Empty> : (
            <RankBars color="var(--color-teal-500)" rows={a.categories.map((c) => ({
              label: c.name, value: c.cost, sub: t.cost ? `${((c.cost / t.cost) * 100).toFixed(0)}%` : undefined,
            }))} />
          )}
        </section>
        <section className="card p-0">
          <h2 className="px-5 pb-2 pt-5 font-semibold text-slate-900">依用途</h2>
          <p className="px-5 pb-3 text-xs text-slate-500">用途就是耗用登記的備註。{NO_REVENUE.join("、")}不算售價。</p>
          {a.purposes.length === 0 ? <Empty>這段期間沒有耗用</Empty> : (
            <table className="table">
              <thead><tr><th>用途</th><th className="num">成本</th><th className="num">售價金額</th><th className="num">價差</th></tr></thead>
              <tbody>
                {a.purposes.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}{!r.revenue && <span className="badge ml-2 bg-slate-100 text-slate-500">不計售價</span>}</td>
                    <td className="num">{fmtMoney(Math.round(r.cost))}</td>
                    <td className="num">{r.revenue ? fmtMoney(Math.round(r.sale)) : "—"}</td>
                    <td className="num">{r.revenue ? fmtMoney(Math.round(r.margin)) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-4 font-semibold text-slate-900">耗用成本前 10 名</h2>
          {a.topCost.length === 0 ? <Empty>這段期間沒有耗用</Empty> : (
            <RankBars color="var(--viz-1)" rows={a.topCost.map((r) => ({ label: r.name, value: r.cost, sub: `${fmtQty(r.qty)} ${r.unit}`, href: `/stock/${r.id}` }))} />
          )}
        </section>
        <section className="card p-0">
          <h2 className="px-5 pb-3 pt-5 font-semibold text-slate-900">價差前 10 名</h2>
          {a.topMargin.length === 0 ? <Empty>還沒有設定售價的品項被耗用</Empty> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>品項</th><th className="num">成本</th><th className="num">售價金額</th><th className="num">價差</th><th className="num">毛利率</th></tr></thead>
                <tbody>
                  {a.topMargin.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/stock/${r.id}`} className="font-medium text-slate-800 hover:text-teal-700">{r.name}</Link></td>
                      <td className="num">{fmtMoney(Math.round(r.cost))}</td>
                      <td className="num">{fmtMoney(Math.round(r.sale))}</td>
                      <td className={`num font-medium ${r.margin < 0 ? "text-rose-600" : "text-slate-900"}`}>{fmtMoney(Math.round(r.margin))}</td>
                      <td className="num">{r.sale ? `${((r.margin / r.sale) * 100).toFixed(1)}%` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {a.unpriced.length > 0 && (
        <section className="card p-0">
          <h2 className="px-5 pb-3 pt-5 font-semibold text-slate-900">還沒設定售價的品項</h2>
          <table className="table">
            <thead><tr><th>料號</th><th>品名</th><th className="num">耗用數量</th><th className="num">耗用成本</th><th></th></tr></thead>
            <tbody>
              {a.unpriced.map((r) => (
                <tr key={r.id}>
                  <td>{r.code}</td><td>{r.name}</td><td className="num">{fmtQty(r.qty)} {r.unit}</td><td className="num">{fmtMoney(Math.round(r.cost))}</td>
                  <td className="text-right"><Link href={`/items/${r.id}`} className="btn-link">設定售價</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <p className="text-xs text-slate-500">
        成本＝耗用時該批的進貨單價。售價金額＝耗用數量 × 品項目前設定的健保價／售價（改價後，過去的期間也會用新價格計算）。
      </p>
    </div>
  );
}
