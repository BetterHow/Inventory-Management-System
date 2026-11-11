import { assertRead, getAccess, getUnit } from "@/lib/auth";
import { writableWarehouses } from "@/lib/pickers";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/SupplierForm";
import { Flash } from "@/components/Flash";
import { createSupplier } from "../actions";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [owners, unit, catRows] = await Promise.all([writableWarehouses(), getUnit(), prisma.supplier.findMany({ where: { category: { not: null } }, distinct: ["category"], select: { category: true } })]);
  const cats = catRows.map((c) => c.category!).sort();
  return (<div><PageHeader title="新增供應商" /><Flash sp={sp} /><SupplierForm action={createSupplier} owners={owners} defaultOwner={owners.find((w) => w.id === unit)?.id ?? null} categories={cats} /></div>);
}
