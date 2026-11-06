import type { Receipt, ReceiptLine, Supplier, Warehouse } from "@prisma/client";
import { Field, CancelLink } from "./ui";
import { LineEditor, type PickItem, type Line } from "./LineEditor";
import { fmtDate, num } from "@/lib/format";
import { todayTaipei } from "@/lib/logic";

export function ReceiptForm({ receipt, suppliers, warehouses, items, inspectionEnabled, action }: {
  receipt?: Receipt & { lines: ReceiptLine[] };
  suppliers: Supplier[];
  warehouses: Warehouse[];
  items: PickItem[];
  inspectionEnabled: boolean;
  action: (fd: FormData) => Promise<void>;
}) {
  const initial: Line[] = (receipt?.lines ?? []).map((l) => ({
    itemId: l.itemId,
    qty: num(l.qty),
    freeQty: num(l.freeQty) || "",
    unitPrice: num(l.unitPrice),
    amount: num(l.amount),
    amountEdited: true,
    lotNo: l.lotNo,
    expiryDate: fmtDate(l.expiryDate, true),
  }));
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Field label="進貨日期"><input type="date" name="date" defaultValue={receipt ? fmtDate(receipt.date, true) : todayTaipei()} className="input" /></Field>
        <Field label="供應商 *">
          <select name="supplierId" defaultValue={receipt?.supplierId ?? ""} className="input" required>
            <option value="">請選擇</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="入庫庫別">
          <select name="warehouseId" defaultValue={receipt?.warehouseId} className="input">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        <Field label="備註"><input name="note" defaultValue={receipt?.note ?? ""} className="input" /></Field>
      </div>

      <LineEditor mode="receipt" items={items} initial={initial} />
      <p className="text-xs text-slate-500">金額預設為數量×單價，可直接改成發票上的金額。系統不會自動加稅。</p>

      {!receipt && (
        <details className="rounded-md border border-slate-200 p-3">
          <summary className="cursor-pointer text-sm font-medium">發票（每次進貨就開發票時填；月結的到「發票」頁合併）</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Field label="發票號碼"><input name="invoiceNumber" className="input" placeholder="AB12345678" /></Field>
            <Field label="發票日期"><input type="date" name="invoiceDate" className="input" /></Field>
            <Field label="發票金額（空白=明細合計）"><input type="number" step="0.01" name="invoiceAmount" className="input" /></Field>
            <Field label="其中稅額（選填）"><input type="number" step="0.01" name="invoiceTax" className="input" /></Field>
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-2">
        <button name="intent" value="arrive" className="btn">
          {inspectionEnabled ? "已到貨，送驗收" : "已到貨，入庫"}
        </button>
        <button name="intent" value="order" className="btn-secondary">只下單（待入庫）</button>
        <CancelLink href={receipt ? `/receipts/${receipt.id}` : "/receipts"} />
      </div>
    </form>
  );
}
