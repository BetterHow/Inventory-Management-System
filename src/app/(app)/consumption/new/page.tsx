import { PageHeader, Field, CancelLink } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { WarehouseLines } from "@/components/LineEditor";
import { pickItems, pickStock, activeWarehouses, itemsByWarehouse } from "@/lib/pickers";
import { todayTaipei } from "@/lib/logic";
import { createConsumption } from "../actions";
import { SuggestInput } from "@/components/SuggestInput";
import { getSettings } from "@/lib/settings";
import { getUnit } from "@/lib/auth";

export default async function NewConsumptionPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [items, { batches, stock }, warehouses, settings, byWh] = await Promise.all([pickItems(), pickStock(), activeWarehouses(), getSettings(), itemsByWarehouse()]);
  const unit = await getUnit();
  return (
    <div>
      <PageHeader title="登記耗用" />
      <Flash sp={sp} />
      <form action={createConsumption} className="card space-y-4">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <Field label="日期"><input type="date" name="date" defaultValue={todayTaipei()} className="input" /></Field>
          <Field label="備註"><SuggestInput name="note" options={settings.consumptionNotes} placeholder="選擇或自行輸入" /></Field>
        </div>
        <WarehouseLines itemsByWh={byWh} mode="consume" items={items} batches={batches} stock={stock} warehouses={warehouses}
          defaultWarehouseId={sp.warehouse ? Number(sp.warehouse) : unit} />
        <div className="flex gap-2"><button className="btn">確認扣庫</button><CancelLink href="/consumption" /></div>
      </form>
    </div>
  );
}
