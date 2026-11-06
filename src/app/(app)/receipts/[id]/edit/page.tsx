import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { ReceiptForm } from "@/components/ReceiptForm";
import { pickItems, activeWarehouses } from "@/lib/pickers";
import { getSettings } from "@/lib/settings";
import { saveReceipt } from "../../actions";

export default async function EditReceiptPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const receipt = await prisma.receipt.findUnique({ where: { id: Number(id) }, include: { lines: true } });
  if (!receipt) notFound();
  const [suppliers, warehouses, items, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    activeWarehouses(),
    pickItems(),
    getSettings(),
  ]);
  return (
    <div>
      <PageHeader title={`編輯進貨單 ${receipt.number}`} />
      <Flash sp={sp} />
      <ReceiptForm receipt={receipt} suppliers={suppliers} warehouses={warehouses} items={items}
        inspectionEnabled={settings.inspectionEnabled} action={saveReceipt.bind(null, receipt.id)} />
    </div>
  );
}
