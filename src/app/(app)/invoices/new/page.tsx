import { prisma } from "@/lib/db";
import { PageHeader, Field, CancelLink } from "@/components/ui";
import { AutoForm } from "@/components/AutoForm";

import { Flash } from "@/components/Flash";
import { fmtDate, fmtMoney } from "@/lib/format";
import { todayTaipei } from "@/lib/logic";
import { createInvoice } from "../actions";

export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const supplierId = sp.supplier ? Number(sp.supplier) : null;
  const suppliers = await prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } });
  const receipts = supplierId
    ? await prisma.receipt.findMany({
        where: { supplierId, invoiceId: null, status: { not: "CANCELLED" } },
        orderBy: { date: "asc" },
      })
    : [];
  return (
    <div className="max-w-3xl">
      <PageHeader title="新增發票" />
      <Flash sp={sp} />
      <AutoForm className="card mb-4 flex items-end gap-2" noButton>
        <Field label="1. 先選供應商" className="flex-1">
          <select name="supplier" defaultValue={supplierId ?? ""} className="input">
            <option value="">請選擇</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        {!supplierId && <CancelLink href="/invoices" />}
      </AutoForm>
      {supplierId && (
        <form action={createInvoice} className="card space-y-4">
          <input type="hidden" name="supplierId" value={supplierId} />
          <div>
            <div className="label">2. 勾選這張發票包含的進貨單（尚未對發票的）</div>
            {receipts.length === 0 ? <p className="text-sm text-slate-400">這個供應商沒有未對發票的進貨單</p> : (
              <table className="table">
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id}>
                      <td className="w-8"><input type="checkbox" name="receiptIds" value={r.id} defaultChecked /></td>
                      <td>{r.number}</td><td>{fmtDate(r.date, true)}</td><td className="num">{fmtMoney(r.totalAmount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="發票號碼 *"><input name="number" className="input" required /></Field>
            <Field label="發票日期"><input type="date" name="date" defaultValue={todayTaipei()} className="input" /></Field>
            <Field label="發票金額（空白=勾選合計）"><input type="number" step="0.01" name="amount" className="input" /></Field>
            <Field label="其中稅額（選填）"><input type="number" step="0.01" name="taxAmount" className="input" /></Field>
          </div>
          <Field label="備註"><input name="note" className="input" /></Field>
          <div className="flex gap-2"><button className="btn">建立發票</button><CancelLink href="/invoices" /></div>
        </form>
      )}
    </div>
  );
}
