import { assertRead, getAccess, getUnit } from "@/lib/auth";
import { writableWarehouses } from "@/lib/pickers";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/SupplierForm";
import { Flash } from "@/components/Flash";
import { updateSupplier } from "../actions";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await prisma.supplier.findUnique({ where: { id: Number(id) } });
  if (!s) notFound();
  if (s.ownerWarehouseId) await assertRead(s.ownerWarehouseId);
  const [owners, unit, catRows] = await Promise.all([writableWarehouses(), getUnit(), prisma.supplier.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } })]);
  const cats = catRows.map((c) => c.category!).sort();
  void unit;
  const readOnly = !!s.ownerWarehouseId && !(await getAccess()).canWrite(s.ownerWarehouseId);
  const ownerName = s.ownerWarehouseId ? (await prisma.warehouse.findUnique({ where: { id: s.ownerWarehouseId } }))?.name : undefined;
  return (<div><PageHeader title={`供應商：${s.name}`} /><Flash sp={sp} /><SupplierForm s={s} action={updateSupplier.bind(null, s.id)} owners={owners} categories={cats} readOnly={readOnly} ownerName={ownerName} /></div>);
}
