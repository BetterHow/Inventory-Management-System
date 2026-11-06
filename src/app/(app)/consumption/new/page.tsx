import { PageHeader, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { WarehouseLines } from "@/components/LineEditor";
import { pickItems, pickStock, activeWarehouses } from "@/lib/pickers";
import { todayTaipei } from "@/lib/logic";
import { createConsumption } from "../actions";
import { SuggestInput } from "@/components/SuggestInput";
import { getSettings } from "@/lib/settings";

export default async function NewConsumptionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [items, { batches, stock }, warehouses, settings] = await Promise.all([pickItems(), pickStock(), activeWarehouses(), getSettings()]);
  return (
    <div>
      <PageHeader title="登記耗用" />
      <Flash sp={sp} />
      <form action={createConsumption} className="card space-y-4">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <Field label="日期"><input type="date" name="date" defaultValue={todayTaipei()} className="input" /></Field>
          <Field label="備註"><SuggestInput name="note" options={settings.consumptionNotes} placeholder="選擇或自行輸入" /></Field>
        </div>
        <WarehouseLines mode="consume" items={items} batches={batches} stock={stock} warehouses={warehouses}
          defaultWarehouseId={sp.warehouse ? Number(sp.warehouse) : undefined} />
        <button className="btn">確認扣庫</button>
      </form>
    </div>
  );
}
