import Link from "next/link";
import type { Prisma, ReceiptStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { requireUser, pickWarehouse, getUnit } from "@/lib/auth";
import { activeWarehouses } from "@/lib/pickers";
import { PageHeader, LinkButton, Empty, Pills, WarehousePills, withParams, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { AutoForm } from "@/components/AutoForm";
import { fmtDate, fmtMoney, num, RECEIPT_STATUS_LABEL, RECEIPT_STATUS_COLOR as STATUS_COLOR } from "@/lib/format";

const INVOICE_FILTER: Record<string, string> = { none: "未對發票", unpaid: "已對發票・未付款", paid: "已付款" };

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [, warehouses, suppliers, categories] = await Promise.all([
    requireUser(),
    activeWarehouses(),
    prisma.supplier.findMany({ orderBy: { name: "asc" } }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);
  const unit = await getUnit();
  const wid = pickWarehouse(sp.warehouse, unit);
  const status = sp.status as ReceiptStatus | undefined;
  const q = sp.q?.trim();

  const byInvoice = sp.dateBy === "invoice";
  const range = sp.from || sp.to
    ? { ...(sp.from ? { gte: new Date(sp.from + "T00:00:00Z") } : {}), ...(sp.to ? { lte: new Date(sp.to + "T00:00:00Z") } : {}) }
    : undefined;
  const where: Prisma.ReceiptWhereInput = {
    ...(wid ? { warehouseId: wid } : {}),
    ...(status ? { status } : {}),
    ...(sp.supplier ? { supplierId: Number(sp.supplier) } : {}),
    ...(range ? (byInvoice ? { invoice: { date: range } } : { date: range }) : {}),
    ...(sp.invoice === "none" ? { invoiceId: null } : {}),
    ...(sp.invoice === "unpaid" ? { invoice: { paid: false } } : {}),
    ...(sp.invoice === "paid" ? { invoice: { paid: true } } : {}),
    ...(sp.category ? { lines: { some: { item: { categoryId: Number(sp.category) } } } } : {}),
    ...(q
      ? {
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { note: { contains: q, mode: "insensitive" } },
            { invoice: { number: { contains: q, mode: "insensitive" } } },
            { lines: { some: { item: { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] } } } },
          ],
        }
      : {}),
  };
  const receipts = await prisma.receipt.findMany({
    where,
    include: { supplier: true, invoice: true },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    take: 300,
  });
  const whName = new Map((await prisma.warehouse.findMany()).map((w) => [w.id, w.name]));
  const total = receipts.filter((r) => r.status !== "CANCELLED").reduce((s, r) => s + num(r.totalAmount), 0);
  const filtering = Boolean(sp.supplier || sp.from || sp.to || sp.dateBy || sp.invoice || sp.category || q);
  const statusTabs: [string, string][] = [["", "全部狀態"], ["ORDERED", "待入庫"], ["PENDING_INSPECTION", "待驗收"], ["RECEIVED", "已入庫"], ["CANCELLED", "已取消"]];

  return (
    <div>
      <PageHeader title="進貨單"><LinkButton href={wid ? `/receipts/new?warehouse=${wid}` : "/receipts/new"}>＋ 新增進貨單</LinkButton></PageHeader>
      <Flash sp={sp} />
      <div className="mb-3 space-y-2">
        <WarehousePills path="/receipts" sp={sp} warehouses={warehouses} current={wid} mine={unit} />
        <Pills items={statusTabs.map(([v, l]) => ({ href: withParams("/receipts", sp, { status: v }), label: l, active: (status ?? "") === v }))} />
      </div>

      <AutoForm className="card mb-3 flex flex-wrap items-end gap-3" clearHref={filtering ? withParams("/receipts", { warehouse: sp.warehouse, status }, {}) : undefined}>
        {/* keep the pill choices when the form is submitted */}
        {sp.warehouse && <input type="hidden" name="warehouse" value={sp.warehouse} />}
        {status && <input type="hidden" name="status" value={status} />}
        <Field label="供應商" className="w-40">
          <select name="supplier" defaultValue={sp.supplier ?? ""} className="input">
            <option value="">全部</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="品項類別" className="w-36">
          <select name="category" defaultValue={sp.category ?? ""} className="input">
            <option value="">全部</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <Field label="發票／付款" className="w-44">
          <select name="invoice" defaultValue={sp.invoice ?? ""} className="input">
            <option value="">全部</option>
            {Object.entries(INVOICE_FILTER).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </Field>
        <Field label="日期依據" className="w-32">
          <select name="dateBy" defaultValue={sp.dateBy ?? ""} className="input">
            <option value="">進貨日期</option>
            <option value="invoice">發票日期</option>
          </select>
        </Field>
        <Field label="日期從" className="w-40"><input type="date" name="from" defaultValue={sp.from ?? ""} className="input" /></Field>
        <Field label="到" className="w-40"><input type="date" name="to" defaultValue={sp.to ?? ""} className="input" /></Field>
        <Field label="關鍵字" className="w-48"><input name="q" defaultValue={q ?? ""} placeholder="單號、發票號、品名、備註" className="input" /></Field>
      </AutoForm>

      <div className="card overflow-x-auto p-0">
        {receipts.length === 0 ? <Empty>沒有符合的進貨單</Empty> : (
          <table className="table">
            <thead><tr><th>單號</th><th>進貨日期</th><th>供應商</th>{!wid && <th>庫別</th>}<th>狀態</th><th className="num">金額</th><th>發票</th><th>發票日期</th><th>付款</th></tr></thead>
            <tbody>
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/receipts/${r.id}`} className="btn-link">{r.number}</Link></td>
                  <td>{fmtDate(r.date, true)}</td>
                  <td>{r.supplier.name}</td>
                  {!wid && <td>{whName.get(r.warehouseId)}</td>}
                  <td><span className={`badge ${STATUS_COLOR[r.status]}`}>{RECEIPT_STATUS_LABEL[r.status]}</span></td>
                  <td className="num">{fmtMoney(r.totalAmount)}</td>
                  <td>{r.invoice ? <Link href={`/invoices/${r.invoice.id}`} className="btn-link">{r.invoice.number}</Link> : <span className="text-slate-400">未對發票</span>}</td>
                  <td>{r.invoice ? fmtDate(r.invoice.date, true) : ""}</td>
                  <td>{r.invoice ? (r.invoice.paid ? "已付" : <span className="text-amber-700">未付</span>) : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-500">
        共 {receipts.length} 張{receipts.length === 300 && "（只顯示最近 300 張，請縮小條件）"}，金額合計 {fmtMoney(total)}（不含已取消）
      </p>
    </div>
  );
}
