import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { attempt } from "@/lib/action";
import { UserError, intVal, str } from "@/lib/form";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";

async function addCategory(fd: FormData) {
  "use server";
  await requireUser();
  await attempt("/categories", async () => {
    const name = str(fd, "name");
    if (!name) throw new UserError("請輸入類別名稱");
    await prisma.category.create({ data: { name, sortOrder: intVal(fd, "sortOrder") } });
  });
  revalidatePath("/categories");
}

async function renameCategory(id: number, fd: FormData) {
  "use server";
  await requireUser();
  await attempt("/categories", async () => {
    const name = str(fd, "name");
    if (!name) throw new UserError("請輸入類別名稱");
    await prisma.category.update({ where: { id }, data: { name, sortOrder: intVal(fd, "sortOrder") } });
  });
  revalidatePath("/categories");
}

async function deleteCategory(id: number) {
  "use server";
  await requireUser();
  const used = await prisma.item.count({ where: { categoryId: id } });
  if (used > 0) redirect("/categories?error=" + encodeURIComponent(`還有 ${used} 個品項用這個類別，請先改掉`));
  await prisma.category.delete({ where: { id } });
  revalidatePath("/categories");
}

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const cats = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { items: true } } },
  });
  return (
    <div className="max-w-2xl">
      <PageHeader title="品項類別" />
      <p className="mb-4 text-sm text-slate-500">類別可自由新增，例如：藥品、醫療耗材、眼鏡、保養液。</p>
      <Flash sp={sp} />
      <div className="card space-y-2">
        {cats.map((c) => (
          <div key={c.id} className="flex flex-wrap items-center gap-2">
            <form action={renameCategory.bind(null, c.id)} className="flex flex-1 items-center gap-2">
              <input name="name" defaultValue={c.name} className="input" />
              <input name="sortOrder" type="number" defaultValue={c.sortOrder} className="input w-20" title="排序" />
              <button className="btn-secondary">儲存</button>
            </form>
            <span className="w-16 text-xs text-slate-400">{c._count.items} 項</span>
            <form action={deleteCategory.bind(null, c.id)}><button className="btn-link text-rose-600">刪除</button></form>
          </div>
        ))}
        <form action={addCategory} className="flex items-center gap-2 border-t border-slate-100 pt-3">
          <input name="name" placeholder="新類別名稱" className="input" />
          <input name="sortOrder" type="number" defaultValue={0} className="input w-20" title="排序" />
          <button className="btn">新增</button>
        </form>
      </div>
    </div>
  );
}
