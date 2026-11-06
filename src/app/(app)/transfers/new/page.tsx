import { PageHeader, Field, CancelLink } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { WarehouseLines } from "@/components/LineEditor";
import { pickItems, pickStock, activeWarehouses, itemsByWarehouse } from "@/lib/pickers";
import { todayTaipei } from "@/lib/logic";
import { createTransfer } from "../actions";
import { getUnit } from "@/lib/auth";

export default async function NewTransferPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [items, { batches, stock }, warehouses, byWh] = await Promise.all([pickItems(), pickStock(), activeWarehouses(), itemsByWarehouse()]);
  const unit = await getUnit();
  const toDefault = warehouses.find((w) => w.id !== (unit ?? warehouses[0]?.id))?.id;
  return (
    <div>
      <PageHeader title="新增庫別調撥" />
      <Flash sp={sp} />
      <form action={createTransfer} className="card space-y-4">
        <div className="grid max-w-2xl grid-cols-3 gap-3">
          <Field label="日期"><input type="date" name="date" defaultValue={todayTaipei()} className="input" /></Field>
          <Field label="調入庫別">
            <select name="toWarehouseId" className="input" defaultValue={toDefault}>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </Field>
          <Field label="備註"><input name="note" className="input" /></Field>
        </div>
        <WarehouseLines itemsByWh={byWh} mode="transfer" warehouseLabel="調出庫別" items={items} batches={batches} stock={stock} warehouses={warehouses} defaultWarehouseId={unit} />
        <div className="flex gap-2"><button className="btn">確認調撥</button><CancelLink href="/transfers" /></div>
      </form>
    </div>
  );
}
