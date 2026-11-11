import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { assertRead } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { ReceiptForm } from "@/components/ReceiptForm";
import { pickItems, writableWarehouses, itemsByWarehouse, ownerVisible } from "@/lib/pickers";
import { getSettings } from "@/lib/settings";
import { saveReceipt } from "../../actions";

export default async function EditReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const receipt = await prisma.receipt.findUnique({ where: { id: Number(id) }, include: { lines: true } });
  if (!receipt) notFound();
  await assertRead(receipt.warehouseId);
  const [suppliers, warehouses, items, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true, ...(await ownerVisible()) }, orderBy: { name: "asc" } }),
    writableWarehouses(),
    pickItems(),
    getSettings(),
  ]);
  const byWh = await itemsByWarehouse();
  return (
    <div>
      <PageHeader title={`編輯進貨單 ${receipt.number}`} />
      <Flash sp={sp} />
      <ReceiptForm itemsByWh={byWh} receipt={receipt} suppliers={suppliers} warehouses={warehouses} items={items}
        inspectionEnabled={settings.inspectionEnabled} action={saveReceipt.bind(null, receipt.id)} />
    </div>
  );
}
