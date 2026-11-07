import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, LinkButton, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtDate, fmtMoney, num } from "@/lib/format";
import { sum } from "@/lib/logic";

export default async function InvoicesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const filter = sp.paid;
  const invoices = await prisma.invoice.findMany({
    where: filter === "0" ? { paid: false } : filter === "1" ? { paid: true } : undefined,
    include: { supplier: true, receipts: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 300,
  });
  const uninvoiced = await prisma.receipt.count({ where: { invoiceId: null, status: "RECEIVED" } });
  const unpaidTotal = sum(invoices.filter((i) => !i.paid).map((i) => num(i.amount)));
  return (
    <div>
      <PageHeader title="發票"><LinkButton href="/invoices/new">＋ 新增發票（可合併多張進貨單）</LinkButton></PageHeader>
      <Flash sp={sp} />
      <div className="mb-3 flex flex-wrap items-center gap-3 text-sm">
        {[["", "全部"], ["0", "未付款"], ["1", "已付款"]].map(([v, l]) => (
          <Link key={v} href={v ? `/invoices?paid=${v}` : "/invoices"}
            className={`rounded-full px-3 py-1 ${(filter ?? "") === v ? "bg-teal-600 text-white" : "border border-slate-200 bg-white"}`}>{l}</Link>
        ))}
        <span className="text-slate-500">列表中未付金額：<b>{fmtMoney(unpaidTotal)}</b></span>
        {uninvoiced > 0 && <Link href="/receipts?warehouse=all&status=RECEIVED&invoice=none" className="text-amber-700">{uninvoiced} 張已入庫進貨單還沒對發票</Link>}
      </div>
      <div className="card overflow-x-auto p-0">
        {invoices.length === 0 ? <Empty>沒有發票</Empty> : (
          <table className="table">
            <thead><tr><th>發票號碼</th><th>日期</th><th>供應商</th><th className="num">發票金額</th><th className="num">進貨單合計</th><th>進貨單數</th><th>付款</th></tr></thead>
            <tbody>
              {invoices.map((i) => {
                const rt = sum(i.receipts.map((r) => num(r.totalAmount)));
                const diff = Math.abs(rt - num(i.amount)) > 0.009;
                return (
                  <tr key={i.id}>
                    <td><Link href={`/invoices/${i.id}`} className="btn-link">{i.number}</Link></td>
                    <td>{fmtDate(i.date, true)}</td>
                    <td>{i.supplier.name}</td>
                    <td className="num">{fmtMoney(i.amount)}</td>
                    <td className={`num ${diff ? "text-amber-700" : ""}`} title={diff ? "與發票金額不同" : ""}>{fmtMoney(rt)}</td>
                    <td>{i.receipts.length}</td>
                    <td>{i.paid ? `已付 ${fmtDate(i.paidAt, true)}` : <span className="text-amber-700">未付</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
