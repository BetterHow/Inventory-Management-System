import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { ReceiptForm } from "@/components/ReceiptForm";
import { pickItems, activeWarehouses, itemsByWarehouse } from "@/lib/pickers";
import { getSettings } from "@/lib/settings";
import { saveReceipt } from "../actions";
import { getUnit } from "@/lib/auth";

export default async function NewReceiptPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [suppliers, warehouses, items, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    activeWarehouses(),
    pickItems(),
    getSettings(),
  ]);
  const byWh = await itemsByWarehouse();
  const unit = await getUnit();
  return (
    <div>
      <PageHeader title="新增進貨單" />
      <Flash sp={sp} />
      <ReceiptForm itemsByWh={byWh} suppliers={suppliers} warehouses={warehouses} items={items}
        inspectionEnabled={settings.inspectionEnabled} action={saveReceipt.bind(null, null)}
        defaultWarehouseId={sp.warehouse ? Number(sp.warehouse) : unit} />
    </div>
  );
}
