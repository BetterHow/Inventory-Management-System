import Link from "@/components/Link";
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CalendarClock, Clock, Hourglass, PackageX, RefreshCw, Wallet, type LucideIcon } from "lucide-react";
import { Empty, Pills, withParams } from "@/components/ui";
import { ShareBar } from "@/components/Charts";
import { inventoryHealth, itemAnalysis, type Period } from "@/lib/analytics";
import { fmtDate, fmtMoney, fmtQty } from "@/lib/format";

const CAT_COLORS = ["var(--viz-1)", "var(--viz-2)", "var(--viz-3)", "var(--viz-4)", "var(--viz-5)"];
const ABC_COLOR = {
  A: "bg-rose-50 text-rose-700 ring-rose-200",
  B: "bg-amber-50 text-amber-800 ring-amber-200",
  C: "bg-slate-100 text-slate-600 ring-slate-200",
};

function Tile({ label, value, hint, icon: Icon, tone = "info" }: { label: string; value: string; hint?: React.ReactNode; icon: LucideIcon; tone?: "info" | "warn" | "bad" }) {
  const chip = { info: "bg-sky-50 text-sky-600 ring-sky-100", warn: "bg-amber-50 text-amber-600 ring-amber-100", bad: "bg-rose-50 text-rose-600 ring-rose-100" }[tone];
  return (
    <div className="card flex items-start gap-3 p-4">
      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${chip}`}><Icon className="size-4" /></span>
      <div className="min-w-0">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className="mt-0.5 text-xl font-bold tabular-nums tracking-tight text-slate-900">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

function Change({ cur, prev }: { cur: number; prev: number }) {
  if (!prev) return cur ? <span className="text-xs text-slate-400">新出現</span> : null;
  const c = ((cur - prev) / prev) * 100;
  if (Math.abs(c) < 0.5) return <span className="text-xs text-slate-400">持平</span>;
  return (
    <span className={`inline-flex items-center text-xs font-medium ${c > 0 ? "text-sky-700" : "text-amber-700"}`}>
      {c > 0 ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(c).toFixed(0)}%
    </span>
  );
}

/** 品項耗用分析：數量、與前期比較、ABC 分類、庫存還夠用幾天。 */
export async function ItemsTab({ cur, prev, wid, sp }: { cur: Period; prev: Period; wid?: number; sp: Record<string, string> }) {
  const a = await itemAnalysis(cur, prev, wid);
  const filter = sp.abc === "A" || sp.abc === "B" || sp.abc === "C" ? sp.abc : null;
  const q = (sp.q ?? "").toLowerCase();
  const rows = a.rows.filter((r) => (!filter || r.abc === filter) && (!q || r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q)));
  const totalItems = a.rows.filter((r) => r.qty > 0).length;
  const shortSoon = a.rows.filter((r) => r.daysLeft !== null && r.daysLeft < 30);

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="期間耗用成本" value={fmtMoney(Math.round(a.total))} hint={`${totalItems} 個品項・${a.days} 天`} icon={Wallet} />
        <Tile label="A 類（佔成本 80%）" value={`${a.abc.count.A} 項`} hint={`${fmtMoney(Math.round(a.abc.cost.A))}，盯緊這些就管住大部分的錢`} icon={AlertTriangle} tone="bad" />
        <Tile label="B 類／C 類" value={`${a.abc.count.B} / ${a.abc.count.C} 項`} hint={`${fmtMoney(Math.round(a.abc.cost.B + a.abc.cost.C))}`} icon={RefreshCw} />
        <Tile label="照目前用量，30 天內會用完" value={`${shortSoon.length} 項`} hint="依這段期間的平均日用量推算" icon={Hourglass} tone={shortSoon.length ? "warn" : "info"} />
      </div>

      {a.total > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold text-slate-900">ABC 分類的成本佔比</h2>
          <ShareBar parts={[
            { label: `A 類 ${a.abc.count.A} 項`, value: a.abc.cost.A, color: "var(--color-rose-500)" },
            { label: `B 類 ${a.abc.count.B} 項`, value: a.abc.cost.B, color: "var(--color-amber-500)" },
            { label: `C 類 ${a.abc.count.C} 項`, value: a.abc.cost.C, color: "var(--viz-5)" },
          ]} />
        </section>
      )}

      <section className="card p-0">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-3 pt-5">
          <h2 className="font-semibold text-slate-900">各品項耗用</h2>
          <div className="flex flex-wrap items-center gap-2">
            <Pills items={[
              { href: withParams("/analytics", sp, { abc: undefined }), label: "全部", active: !filter },
              ...(["A", "B", "C"] as const).map((k) => ({ href: withParams("/analytics", sp, { abc: k }), label: `${k} 類`, active: filter === k })),
            ]} />
            <form className="flex gap-1">
              {Object.entries(sp).filter(([k]) => k !== "q").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
              <input name="q" defaultValue={sp.q} placeholder="搜尋品項" className="input w-36 py-1 text-sm" />
            </form>
          </div>
        </div>
        {rows.length === 0 ? <Empty>這段期間沒有耗用</Empty> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ABC</th><th>品項</th><th className="num">耗用數量</th><th className="num">前一期</th><th>增減</th>
                  <th className="num">成本</th><th className="num">佔比</th><th className="num">收入</th><th className="num">毛利率</th><th className="num">開藥次</th>
                  <th className="num">目前庫存</th><th className="num">可用天數</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td><span className={`badge ring-1 ring-inset ${ABC_COLOR[r.abc]}`}>{r.abc}</span></td>
                    <td><Link href={`/stock/${r.id}${wid ? `?warehouse=${wid}` : ""}`} className="font-medium text-slate-800 hover:text-teal-700">{r.name}</Link> <span className="text-xs text-slate-400">{r.code}</span></td>
                    <td className="num">{fmtQty(r.qty)} {r.unit}</td>
                    <td className="num text-slate-500">{fmtQty(r.prevQty)}</td>
                    <td><Change cur={r.qty} prev={r.prevQty} /></td>
                    <td className="num">{fmtMoney(Math.round(r.cost))}</td>
                    <td className="num text-slate-500">{(r.share * 100).toFixed(1)}%</td>
                    <td className="num">{r.sale ? fmtMoney(Math.round(r.sale)) : "—"}</td>
                    <td className={`num ${r.margin < 0 ? "text-rose-600" : ""}`}>{r.sale ? `${((r.margin / r.sale) * 100).toFixed(1)}%` : "—"}</td>
                    <td className="num">{r.rx || ""}</td>
                    <td className={`num ${r.stock < 0 ? "text-rose-600" : ""}`}>{fmtQty(r.stock)}</td>
                    <td className={`num ${r.daysLeft !== null && r.daysLeft < 30 ? "font-semibold text-rose-600" : ""}`}>{r.daysLeft ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <p className="text-xs text-slate-500">ABC 分類：依耗用成本由高到低排，累計前 80% 的品項為 A 類、接下來 15% 為 B 類、其餘為 C 類。A 類建議盤點更勤、安全量訂得更精準。可用天數＝目前庫存 ÷ 這段期間的平均日用量。開藥次來自 HIS 匯入。</p>
    </div>
  );
}

/** 庫存健康度：庫存金額、可用月數、周轉率、近效與呆滯。 */
export async function StockTab({ wid }: { wid?: number }) {
  const h = await inventoryHealth(wid);
  const months = h.monthsOnHand;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Tile label="目前庫存金額" value={fmtMoney(Math.round(h.totalValue))} hint={`每月平均耗用 ${fmtMoney(Math.round(h.monthlyCost))}`} icon={Wallet} />
        <Tile label="庫存可用月數" value={months == null ? "—" : `${months.toFixed(1)} 個月`} hint={h.turnover == null ? "沒有耗用資料" : `年周轉 ${h.turnover.toFixed(1)} 次（依近 ${h.usageDays} 天）`} icon={Clock}
          tone={months != null && months > 6 ? "warn" : "info"} />
        <Tile label={`${h.warnDays} 天內到期`} value={fmtMoney(Math.round(h.expiringValue))} hint={h.expiredValue ? `另有已過期 ${fmtMoney(Math.round(h.expiredValue))}` : "沒有已過期的批號"} icon={CalendarClock}
          tone={h.expiredValue ? "bad" : h.expiringValue ? "warn" : "info"} />
        <Tile label="呆滯庫存" value={fmtMoney(Math.round(h.slowValue))} hint={`${h.slow.length} 項近 ${h.usageDays} 天都沒用到`} icon={PackageX} tone={h.slow.length ? "warn" : "info"} />
      </div>

      {h.categories.length > 0 && (
        <section className="card">
          <h2 className="mb-3 font-semibold text-slate-900">庫存金額依類別</h2>
          <ShareBar parts={h.categories.map((c, i) => ({ label: c.name, value: c.value, color: CAT_COLORS[i % CAT_COLORS.length] }))} />
        </section>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <section className="card p-0">
          <h2 className="px-5 pb-1 pt-5 font-semibold text-slate-900">近效批號</h2>
          <p className="px-5 pb-3 text-xs text-slate-500">「用得完嗎」依近 {h.usageDays} 天的用量推算到期前能不能用完，用不完的建議先用、調撥給其他單位，或聯絡廠商退換。</p>
          {h.expiring.length === 0 ? <Empty>沒有快到期的批號</Empty> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>品項</th><th>批號</th><th>效期</th><th className="num">數量</th><th className="num">金額</th><th>用得完嗎</th></tr></thead>
                <tbody>
                  {h.expiring.map((b, i) => {
                    const monthsLeft = (b.expiry.getTime() - Date.now()) / (30 * 86400000);
                    const expired = monthsLeft < 0;
                    const ok = !expired && b.monthsToUse !== null && b.monthsToUse <= monthsLeft;
                    return (
                      <tr key={i}>
                        <td><Link href={`/stock/${b.id}`} className="font-medium text-slate-800 hover:text-teal-700">{b.name}</Link></td>
                        <td>{b.lotNo || "—"}</td>
                        <td className={expired ? "font-semibold text-rose-600" : ""}>{fmtDate(b.expiry, true)}</td>
                        <td className="num">{fmtQty(b.qty)} {b.unit}</td>
                        <td className="num">{fmtMoney(Math.round(b.value))}</td>
                        <td>{expired ? <span className="badge bg-rose-600 text-white">已過期</span>
                          : ok ? <span className="badge bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200">用得完</span>
                          : <span className="badge bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200">{b.monthsToUse === null ? "近期沒用到" : `約需 ${b.monthsToUse.toFixed(1)} 個月`}</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <section className="card p-0">
          <h2 className="px-5 pb-1 pt-5 font-semibold text-slate-900">呆滯品項</h2>
          <p className="px-5 pb-3 text-xs text-slate-500">有庫存，但近 {h.usageDays} 天沒有耗用。可以考慮停止採購、調撥或退貨。</p>
          {h.slow.length === 0 ? <Empty>沒有呆滯品項</Empty> : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>品項</th><th>類別</th><th className="num">庫存</th><th className="num">金額</th><th>最後耗用</th></tr></thead>
                <tbody>
                  {h.slow.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/stock/${r.id}`} className="font-medium text-slate-800 hover:text-teal-700">{r.name}</Link></td>
                      <td>{r.category}</td>
                      <td className="num">{fmtQty(r.qty)} {r.unit}</td>
                      <td className="num">{fmtMoney(Math.round(r.value))}</td>
                      <td>{r.lastUsed ? fmtDate(r.lastUsed) : "從未"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <p className="text-xs text-slate-500">庫存可用月數＝庫存金額 ÷ 每月平均耗用成本，一般診所 1～3 個月較健康；太高表示錢壓在庫存上。年周轉次數＝一年耗用成本 ÷ 庫存金額，越高越好。</p>
    </div>
  );
}
