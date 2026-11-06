import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, LinkButton, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtDate, fmtMoney, RECEIPT_STATUS_LABEL, RECEIPT_STATUS_COLOR as STATUS_COLOR } from "@/lib/format";
import type { ReceiptStatus } from "@prisma/client";

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const status = sp.status as ReceiptStatus | undefined;
  const receipts = await prisma.receipt.findMany({
    where: status ? { status } : undefined,
    include: { supplier: true, invoice: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 300,
  });
  const warehouses = new Map((await prisma.warehouse.findMany()).map((w) => [w.id, w.name]));
  const tabs: [string, string][] = [["", "全部"], ["ORDERED", "待入庫"], ["PENDING_INSPECTION", "待驗收"], ["RECEIVED", "已入庫"], ["CANCELLED", "已取消"]];
  return (
    <div>
      <PageHeader title="進貨單"><LinkButton href="/receipts/new">＋ 新增進貨單</LinkButton></PageHeader>
      <Flash sp={sp} />
      <div className="mb-3 flex flex-wrap gap-1">
        {tabs.map(([v, l]) => (
          <Link key={v} href={v ? `/receipts?status=${v}` : "/receipts"}
            className={`rounded-full px-3 py-1 text-sm ${(status ?? "") === v ? "bg-teal-600 text-white" : "bg-white text-slate-600 border border-slate-200"}`}>
            {l}
          </Link>
        ))}
      </div>
      <div className="card overflow-x-auto p-0">
        {receipts.length === 0 ? <Empty>沒有進貨單</Empty> : (
          <table className="table">
            <thead><tr><th>單號</th><th>日期</th><th>供應商</th><th>庫別</th><th>狀態</th><th className="num">金額</th><th>發票</th><th>付款</th></tr></thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/receipts/${r.id}`} className="btn-link">{r.number}</Link></td>
                  <td>{fmtDate(r.date, true)}</td>
                  <td>{r.supplier.name}</td>
                  <td>{warehouses.get(r.warehouseId)}</td>
                  <td><span className={`badge ${STATUS_COLOR[r.status]}`}>{RECEIPT_STATUS_LABEL[r.status]}</span></td>
                  <td className="num">{fmtMoney(r.totalAmount)}</td>
                  <td>{r.invoice ? <Link href={`/invoices/${r.invoice.id}`} className="btn-link">{r.invoice.number}</Link> : <span className="text-slate-400">未對發票</span>}</td>
                  <td>{r.invoice ? (r.invoice.paid ? "已付" : <span className="text-amber-700">未付</span>) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
