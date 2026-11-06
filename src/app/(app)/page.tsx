import Link from "next/link";
import { prisma } from "@/lib/db";
import { SafetyBadge, ExpiryBadge } from "@/components/ui";
import { stockOverview } from "@/lib/overview";
import { fmtDate, fmtMoney, fmtQty, num } from "@/lib/format";
import { parseTaipeiDate, sum, taipeiParts } from "@/lib/logic";

function Stat({ label, value, href, tone }: { label: string; value: string | number; href: string; tone?: "warn" | "bad" }) {
  const color = tone === "bad" ? "text-rose-600" : tone === "warn" ? "text-amber-600" : "text-slate-800";
  return (
    <Link href={href} className="card block hover:border-teal-400">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</div>
    </Link>
  );
}

export default async function Dashboard() {
  const p = taipeiParts(new Date());
  const monthStart = parseTaipeiDate(`${p.y}-${String(p.m).padStart(2, "0")}-01`);
  const monthStartDate = new Date(Date.UTC(p.y, p.m - 1, 1));
  const [rows, consumed, received, ordered, pendingInspection, noInvoice, unpaid] = await Promise.all([
    stockOverview(),
    prisma.stockMovement.findMany({ where: { type: "CONSUME", date: { gte: monthStart } }, select: { qty: true, unitCost: true } }),
    prisma.receipt.aggregate({ where: { status: "RECEIVED", date: { gte: monthStartDate } }, _sum: { totalAmount: true } }),
    prisma.receipt.count({ where: { status: "ORDERED" } }),
    prisma.receipt.count({ where: { status: "PENDING_INSPECTION" } }),
    prisma.receipt.count({ where: { status: "RECEIVED", invoiceId: null } }),
    prisma.invoice.aggregate({ where: { paid: false }, _sum: { amount: true } }),
  ]);
  const low = rows.filter((r) => r.status === "NEGATIVE" || r.status === "LT1");
  const expiring = rows.filter((r) => r.expiry === "EXPIRED" || r.expiry === "DANGER" || r.expiry === "WARN");
  const consumedAmt = sum(consumed.map((m) => -num(m.qty) * num(m.unitCost)));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">首頁</h1>
        <div className="flex gap-2">
          <Link href="/consumption/new" className="btn">登記耗用</Link>
          <Link href="/receipts/new" className="btn-secondary">新增進貨</Link>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="不足1個月／負庫存" value={low.length} href="/stock?warehouse=all&status=LT1" tone={low.length ? "bad" : undefined} />
        <Stat label="效期需注意的品項" value={expiring.length} href="/reports?tab=expiry" tone={expiring.length ? "warn" : undefined} />
        <Stat label="本月耗用金額" value={fmtMoney(consumedAmt)} href="/reports?tab=consumption&measure=amount" />
        <Stat label="本月進貨金額" value={fmtMoney(received._sum.totalAmount)} href="/reports?tab=receiving" />
        <Stat label="待入庫進貨單" value={ordered} href="/receipts?status=ORDERED" tone={ordered ? "warn" : undefined} />
        <Stat label="待驗收進貨單" value={pendingInspection} href="/receipts?status=PENDING_INSPECTION" tone={pendingInspection ? "warn" : undefined} />
        <Stat label="已入庫未對發票" value={noInvoice} href="/receipts?status=RECEIVED" tone={noInvoice ? "warn" : undefined} />
        <Stat label="未付發票金額" value={fmtMoney(unpaid._sum.amount)} href="/invoices?paid=0" />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-2 font-semibold">需要補貨（全部庫別合計）</h2>
          {low.length === 0 ? <p className="text-sm text-slate-400">目前沒有</p> : (
            <table className="table">
              <tbody>
                {low.slice(0, 10).map((r) => (
                  <tr key={r.itemId}>
                    <td><Link href={`/stock/${r.itemId}`} className="btn-link">{r.name}</Link></td>
                    <td className="num">{fmtQty(r.stock)} {r.unit}</td>
                    <td><SafetyBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card">
          <h2 className="mb-2 font-semibold">效期提醒</h2>
          {expiring.length === 0 ? <p className="text-sm text-slate-400">目前沒有</p> : (
            <table className="table">
              <tbody>
                {expiring.sort((a, b) => (a.nearestExpiry?.getTime() ?? 0) - (b.nearestExpiry?.getTime() ?? 0)).slice(0, 10).map((r) => (
                  <tr key={r.itemId}>
                    <td><Link href={`/stock/${r.itemId}`} className="btn-link">{r.name}</Link></td>
                    <td>{fmtDate(r.nearestExpiry, true)}</td>
                    <td><ExpiryBadge status={r.expiry} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
