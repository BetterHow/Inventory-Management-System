import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Field, Notice, CancelLink } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtDate, fmtMoney, num, RECEIPT_STATUS_LABEL } from "@/lib/format";
import { sum, todayTaipei } from "@/lib/logic";
import { deleteInvoice, updateInvoice } from "../actions";

export default async function InvoicePage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const inv = await prisma.invoice.findUnique({ where: { id: Number(id) }, include: { supplier: true, receipts: true } });
  if (!inv) notFound();
  const rt = sum(inv.receipts.map((r) => num(r.totalAmount)));
  const diff = Math.round((num(inv.amount) - rt) * 100) / 100;
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={`發票 ${inv.number}`}>
        <form action={deleteInvoice.bind(null, inv.id)}><button className="btn-secondary text-rose-600">刪除發票</button></form>
      </PageHeader>
      <Flash sp={sp} />
      {diff !== 0 && <Notice kind="warn">發票金額與進貨單合計差 {fmtMoney(diff)}，請確認。</Notice>}
      <form action={updateInvoice.bind(null, inv.id)} className="card grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="供應商"><div className="py-1.5 text-sm">{inv.supplier.name}</div></Field>
        <Field label="發票號碼"><input name="number" defaultValue={inv.number} className="input" /></Field>
        <Field label="發票日期"><input type="date" name="date" defaultValue={fmtDate(inv.date, true)} className="input" /></Field>
        <Field label="發票金額"><input type="number" step="0.01" name="amount" defaultValue={num(inv.amount)} className="input" /></Field>
        <Field label="其中稅額"><input type="number" step="0.01" name="taxAmount" defaultValue={inv.taxAmount ? num(inv.taxAmount) : ""} className="input" /></Field>
        <label className="flex items-center gap-2 pt-5 text-sm"><input type="checkbox" name="paid" defaultChecked={inv.paid} /> 已付款</label>
        <Field label="付款日期"><input type="date" name="paidAt" defaultValue={inv.paidAt ? fmtDate(inv.paidAt, true) : todayTaipei()} className="input" /></Field>
        <Field label="備註"><input name="note" defaultValue={inv.note ?? ""} className="input" /></Field>
        <div className="col-span-2 flex gap-2 sm:col-span-4"><button className="btn">儲存</button><CancelLink href="/invoices" label="返回列表" /></div>
      </form>
      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>進貨單</th><th>日期</th><th>狀態</th><th className="num">金額</th></tr></thead>
          <tbody>
            {inv.receipts.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/receipts/${r.id}`} className="btn-link">{r.number}</Link></td>
                <td>{fmtDate(r.date, true)}</td><td>{RECEIPT_STATUS_LABEL[r.status]}</td><td className="num">{fmtMoney(r.totalAmount)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={3} className="text-right font-medium">合計</td><td className="num font-semibold">{fmtMoney(rt)}</td></tr></tfoot>
        </table>
      </div>
    </div>
  );
}
