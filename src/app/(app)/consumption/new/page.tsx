import { PageHeader, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { WarehouseLines } from "@/components/LineEditor";
import { pickItems, pickStock, activeWarehouses } from "@/lib/pickers";
import { todayTaipei } from "@/lib/logic";
import { createConsumption } from "../actions";

export default async function NewConsumptionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [items, { batches, stock }, warehouses] = await Promise.all([pickItems(), pickStock(), activeWarehouses()]);
  return (
    <div>
      <PageHeader title="登記耗用" />
      <Flash sp={sp} />
      <form action={createConsumption} className="card space-y-4">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <Field label="日期"><input type="date" name="date" defaultValue={todayTaipei()} className="input" /></Field>
          <Field label="備註"><input name="note" className="input" placeholder="例：今日門診耗用" /></Field>
        </div>
        <WarehouseLines mode="consume" items={items} batches={batches} stock={stock} warehouses={warehouses}
          defaultWarehouseId={sp.warehouse ? Number(sp.warehouse) : undefined} />
        <button className="btn">確認扣庫</button>
      </form>
    </div>
  );
}
