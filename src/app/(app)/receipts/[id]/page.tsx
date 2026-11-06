import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtDate, fmtDateTime, fmtMoney, fmtQty, RECEIPT_STATUS_LABEL, RECEIPT_STATUS_COLOR as STATUS_COLOR } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { cancelReceipt, inspectReceipt, linkInvoice, unlinkInvoice } from "../actions";

export default async function ReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const r = await prisma.receipt.findUnique({
    where: { id: Number(id) },
    include: { supplier: true, invoice: true, lines: true },
  });
  if (!r) notFound();
  const [items, warehouse, users, openInvoices, settings] = await Promise.all([
    prisma.item.findMany({ where: { id: { in: r.lines.map((l) => l.itemId) } } }),
    prisma.warehouse.findUnique({ where: { id: r.warehouseId } }),
    prisma.user.findMany(),
    prisma.invoice.findMany({ where: { supplierId: r.supplierId, paid: false }, orderBy: { date: "desc" } }),
    getSettings(),
  ]);
  const itemMap = new Map(items.map((i) => [i.id, i]));
  const userName = (uid: number | null) => users.find((u) => u.id === uid)?.name ?? "";
  const editable = r.status === "ORDERED" || r.status === "PENDING_INSPECTION";

  return (
    <div className="space-y-4">
      <PageHeader title={`進貨單 ${r.number}`}>
        {editable && <Link href={`/receipts/${r.id}/edit`} className="btn-secondary">編輯／到貨填批號</Link>}
        {editable && (
          <form action={inspectReceipt.bind(null, r.id)}>
            <button className="btn">{r.status === "PENDING_INSPECTION" || settings.inspectionEnabled ? "驗收入庫" : "到貨入庫"}</button>
          </form>
        )}
        {editable && (
          <form action={cancelReceipt.bind(null, r.id)}><button className="btn-secondary text-rose-600">取消此單</button></form>
        )}
      </PageHeader>
      <Flash sp={sp} />
      <div className="card grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div><div className="label">狀態</div><span className={`badge ${STATUS_COLOR[r.status]}`}>{RECEIPT_STATUS_LABEL[r.status]}</span></div>
        <div><div className="label">進貨日期</div>{fmtDate(r.date, true)}</div>
        <div><div className="label">供應商</div>{r.supplier.name}</div>
        <div><div className="label">庫別</div>{warehouse?.name}</div>
        <div><div className="label">建立人</div>{userName(r.createdById)}</div>
        <div><div className="label">驗收</div>{r.inspectedAt ? `${userName(r.inspectedById)} ${fmtDateTime(r.inspectedAt)}` : ""}</div>
        <div><div className="label">入庫時間</div>{fmtDateTime(r.receivedAt)}</div>
        <div><div className="label">備註</div>{r.note}</div>
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="table">
          <thead><tr><th>料號</th><th>品名</th><th className="num">數量</th><th className="num">贈品</th><th className="num">單價</th><th className="num">金額</th><th>批號</th><th>效期</th></tr></thead>
          <tbody>
            {r.lines.map((l) => {
              const it = itemMap.get(l.itemId);
              return (
                <tr key={l.id}>
                  <td>{it?.code}</td><td>{it?.name}</td>
                  <td className="num">{fmtQty(l.qty)} {it?.unit}</td>
                  <td className="num">{Number(l.freeQty) ? fmtQty(l.freeQty) : ""}</td>
                  <td className="num">{fmtMoney(l.unitPrice)}</td>
                  <td className="num">{fmtMoney(l.amount)}</td>
                  <td>{l.lotNo}</td><td>{fmtDate(l.expiryDate, true)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td colSpan={5} className="text-right font-medium">合計</td><td className="num font-semibold">{fmtMoney(r.totalAmount)}</td><td colSpan={2}></td></tr></tfoot>
        </table>
      </div>

      <div className="card">
        <h2 className="mb-2 font-semibold">發票</h2>
        {r.invoice ? (
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href={`/invoices/${r.invoice.id}`} className="btn-link">{r.invoice.number}</Link>
            <span>{fmtDate(r.invoice.date, true)}</span>
            <span>發票金額 {fmtMoney(r.invoice.amount)}</span>
            <span>{r.invoice.paid ? "已付款" : "未付款"}</span>
            <form action={unlinkInvoice.bind(null, r.id)}><button className="btn-link text-rose-600">解除</button></form>
          </div>
        ) : (
          <form action={linkInvoice.bind(null, r.id)} className="grid grid-cols-2 items-end gap-3 sm:grid-cols-6">
            {openInvoices.length > 0 && (
              <Field label="併入既有發票（月結）" className="col-span-2">
                <select name="invoiceId" className="input">
                  <option value="">— 新開一張 —</option>
                  {openInvoices.map((i) => <option key={i.id} value={i.id}>{i.number}（{fmtDate(i.date, true)}）</option>)}
                </select>
              </Field>
            )}
            <Field label="發票號碼"><input name="invoiceNumber" className="input" /></Field>
            <Field label="發票日期"><input type="date" name="invoiceDate" className="input" /></Field>
            <Field label="金額（空白=本單合計）"><input type="number" step="0.01" name="invoiceAmount" className="input" /></Field>
            <button className="btn">設定發票</button>
          </form>
        )}
      </div>
    </div>
  );
}
