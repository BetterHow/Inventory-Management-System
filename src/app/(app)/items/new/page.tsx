import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { ItemForm } from "@/components/ItemForm";
import { Flash } from "@/components/Flash";
import { createItem } from "../actions";

export default async function NewItemPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [categories, suppliers] = await Promise.all([
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.supplier.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="新增品項" />
      <Flash sp={sp} />
      <ItemForm categories={categories} suppliers={suppliers} action={createItem} />
    </div>
  );
}
