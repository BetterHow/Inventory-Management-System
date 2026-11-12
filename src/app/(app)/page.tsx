import Link from "@/components/Link";
import { prisma } from "@/lib/db";
import { SafetyBadge, ExpiryBadge } from "@/components/ui";
import { stockOverview } from "@/lib/overview";
import { fmtDate, fmtMoney, fmtQty, num } from "@/lib/format";
import { parseTaipeiDate, sum, taipeiParts, todayTaipei } from "@/lib/logic";
import { getUnit, requireUser } from "@/lib/auth";
import { periodMargin } from "@/lib/analytics";
import {
  AlertTriangle, CalendarClock, ClipboardMinus, PackagePlus, ShoppingCart, Boxes, Truck, ClipboardCheck,
  FileWarning, Wallet, Percent, TrendingDown, TrendingUp, ChevronRight, CheckCircle2, type LucideIcon,
} from "lucide-react";

type Tone = "bad" | "warn" | "ok" | "info";
const TONE: Record<Tone, { chip: string; text: string }> = {
  bad: { chip: "bg-rose-50 text-rose-600 ring-rose-100", text: "text-rose-600" },
  warn: { chip: "bg-amber-50 text-amber-600 ring-amber-100", text: "text-amber-600" },
  ok: { chip: "bg-emerald-50 text-emerald-600 ring-emerald-100", text: "text-slate-900" },
  info: { chip: "bg-sky-50 text-sky-600 ring-sky-100", text: "text-slate-900" },
};

function Stat({ label, value, href, tone, icon: Icon, hint }: {
  label: string; value: string | number; href: string; tone: Tone; icon: LucideIcon; hint?: string;
}) {
  const t = TONE[tone];
  return (
    <Link href={href} className="card group flex flex-col items-start gap-2 p-4 transition sm:flex-row sm:gap-4 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
      <span className={`grid size-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${t.chip}`}><Icon className="size-5" /></span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-medium text-slate-500">{label}</div>
        <div className={`mt-0.5 text-2xl font-bold tabular-nums tracking-tight ${t.text}`}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-slate-400">{hint}</div>}
      </div>
      <ChevronRight className="mt-1 hidden size-4 text-slate-300 sm:block transition group-hover:translate-x-0.5 group-hover:text-teal-500" />
    </Link>
  );
}

function Action({ href, label, desc, icon: Icon, color }: { href: string; label: string; desc: string; icon: LucideIcon; color: string }) {
  return (
    <Link href={href} className="card group flex flex-col items-start gap-2.5 p-4 transition sm:flex-row sm:items-center sm:gap-3.5 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl text-white shadow-sm ${color}`}><Icon className="size-5" /></span>
      <div className="min-w-0">
        <div className="font-semibold text-slate-900">{label}</div>
        <div className="hidden truncate text-xs text-slate-500 sm:block">{desc}</div>
      </div>
    </Link>
  );
}

function Panel({ title, icon: Icon, href, children }: { title: string; icon: LucideIcon; href: string; children: React.ReactNode }) {
  return (
    <section className="card p-0">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
        <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Icon className="size-4 text-teal-600" />{title}</h2>
        <Link href={href} className="flex items-center gap-0.5 text-xs font-medium text-slate-500 hover:text-teal-700">查看全部<ChevronRight className="size-3.5" /></Link>
      </div>
      {children}
    </section>
  );
}

function AllGood({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-sm text-slate-400">
      <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-500"><CheckCircle2 className="size-5" /></span>
      {text}
    </div>
  );
}

export default async function Dashboard() {
  const p = taipeiParts(new Date());
  const monthStart = parseTaipeiDate(`${p.y}-${String(p.m).padStart(2, "0")}-01`);
  const monthStartDate = new Date(Date.UTC(p.y, p.m - 1, 1));
  const [unit, user] = await Promise.all([getUnit(), requireUser()]);
  const wh = unit ? { warehouseId: unit } : {};
  const unitName = unit ? (await prisma.warehouse.findUnique({ where: { id: unit } }))?.name : null;
  const monthFrom = `${p.y}-${String(p.m).padStart(2, "0")}-01`;
  const [rows, consumed, received, ordered, pendingInspection, noInvoice, unpaid, margin] = await Promise.all([
    stockOverview(unit).then((r) => r.filter((x) => x.inWarehouse)),
    prisma.stockMovement.findMany({ where: { type: "CONSUME", date: { gte: monthStart }, ...wh }, select: { qty: true, unitCost: true } }),
    prisma.receipt.aggregate({ where: { status: "RECEIVED", date: { gte: monthStartDate }, ...wh }, _sum: { totalAmount: true } }),
    prisma.receipt.count({ where: { status: "ORDERED", ...wh } }),
    prisma.receipt.count({ where: { status: "PENDING_INSPECTION", ...wh } }),
    prisma.receipt.count({ where: { status: "RECEIVED", invoiceId: null, ...wh } }),
    prisma.invoice.aggregate({ where: { paid: false }, _sum: { amount: true } }),
    periodMargin(monthFrom, todayTaipei(), unit),
  ]);
  const low = rows.filter((r) => r.status === "NEGATIVE" || r.status === "LT1");
  const expiring = rows.filter((r) => r.expiry === "EXPIRED" || r.expiry === "DANGER" || r.expiry === "WARN");
  const consumedAmt = sum(consumed.map((m) => -num(m.qty) * num(m.unitCost)));

  const lowList = low.slice(0, 8);
  const expList = expiring.sort((a, b) => (a.nearestExpiry?.getTime() ?? 0) - (b.nearestExpiry?.getTime() ?? 0)).slice(0, 8);
  const todo = ordered + pendingInspection + noInvoice;

  return (
    <div className="space-y-7">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-slate-500">
            目前查看 <span className="font-medium text-teal-700">{unitName ?? "全部單位"}</span>
            {low.length + expiring.length + todo === 0 ? "，今天沒有待處理的事項。" : `，有 ${low.length + expiring.length + todo} 件事項需要留意。`}
          </p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">常用功能</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Action href="/consumption/new" label="登記耗用" desc="門診扣庫、各單位領用" icon={ClipboardMinus} color="bg-gradient-to-br from-teal-500 to-teal-600" />
          <Action href="/receipts/new" label="新增進貨" desc="到貨入庫或先下單" icon={PackagePlus} color="bg-gradient-to-br from-sky-500 to-sky-600" />
          <Action href="/purchase-list" label="待採購清單" desc="記下要訂的東西" icon={ShoppingCart} color="bg-gradient-to-br from-violet-500 to-violet-600" />
          <Action href="/stock" label="庫存總覽" desc="各品項庫存與安全量" icon={Boxes} color="bg-gradient-to-br from-amber-500 to-orange-500" />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">需要留意</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="不足 1 個月／負庫存" value={low.length} href="/stock?status=LT1" tone={low.length ? "bad" : "ok"} icon={AlertTriangle} />
          <Stat label="效期需注意" value={expiring.length} href="/reports?tab=expiry" tone={expiring.length ? "warn" : "ok"} icon={CalendarClock} />
          <Stat label="待入庫／待驗收" value={`${ordered} / ${pendingInspection}`} href={ordered || !pendingInspection ? "/receipts?status=ORDERED" : "/receipts?status=PENDING_INSPECTION"} tone={ordered + pendingInspection ? "warn" : "ok"} icon={Truck} />
          <Stat label="已入庫未對發票" value={noInvoice} href="/receipts?status=RECEIVED&invoice=none" tone={noInvoice ? "warn" : "ok"} icon={FileWarning} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-slate-500">本月金額</h2>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Stat label="本月耗用成本" value={fmtMoney(Math.round(consumedAmt))} href="/analytics" tone="info" icon={TrendingDown} />
          <Stat label="本月價差" value={fmtMoney(Math.round(margin.margin))} href="/analytics" tone="info" icon={Percent}
            hint={margin.sale ? `毛利率 ${((margin.margin / margin.sale) * 100).toFixed(1)}%` : "品項設定售價後才會計算"} />
          <Stat label="本月進貨" value={fmtMoney(received._sum.totalAmount)} href="/reports?tab=receiving" tone="info" icon={TrendingUp} />
          <Stat label="未付發票" value={fmtMoney(unpaid._sum.amount)} href="/invoices?paid=0" tone="info" icon={Wallet} hint="全部單位" />
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`需要補貨${unitName ? `・${unitName}` : ""}`} icon={ClipboardCheck} href="/purchase-list">
          {lowList.length === 0 ? <AllGood text="庫存都充足" /> : (
            <table className="table">
              <tbody>
                {lowList.map((r) => (
                  <tr key={r.itemId}>
                    <td><Link href={`/stock/${r.itemId}`} className="font-medium text-slate-800 hover:text-teal-700">{r.name}</Link></td>
                    <td className="num text-slate-600">{fmtQty(r.stock)} {r.unit}</td>
                    <td className="w-24 text-right"><SafetyBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
        <Panel title="效期提醒" icon={CalendarClock} href="/reports?tab=expiry">
          {expList.length === 0 ? <AllGood text="沒有快到期的品項" /> : (
            <table className="table">
              <tbody>
                {expList.map((r) => (
                  <tr key={r.itemId}>
                    <td><Link href={`/stock/${r.itemId}`} className="font-medium text-slate-800 hover:text-teal-700">{r.name}</Link></td>
                    <td className="text-slate-600">{fmtDate(r.nearestExpiry, true)}</td>
                    <td className="w-24 text-right"><ExpiryBadge status={r.expiry} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  );
}
