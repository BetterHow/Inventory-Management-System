import { prisma } from "@/lib/db";
import { getUnit } from "@/lib/auth";
import { writableWarehouses, ownerVisible } from "@/lib/pickers";
import { PageHeader } from "@/components/ui";
import { ItemForm } from "@/components/ItemForm";
import { Flash } from "@/components/Flash";
import { createItem } from "../actions";

export default async function NewItemPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [owners, unit] = await Promise.all([writableWarehouses(), getUnit()]);
  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.supplier.findMany({ where: { active: true, ...(await ownerVisible()) }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="新增品項" />
      <Flash sp={sp} />
      <ItemForm categories={categories} suppliers={suppliers} action={createItem} owners={owners} defaultOwner={owners.find((w) => w.id === unit)?.id ?? null} />
    </div>
  );
}
