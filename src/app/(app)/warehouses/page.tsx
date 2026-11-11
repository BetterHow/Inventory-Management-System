import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { attempt } from "@/lib/action";
import { UserError, bool, intVal, optStr, str } from "@/lib/form";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";

function read(fd: FormData) {
  const code = str(fd, "code");
  const name = str(fd, "name");
  if (!code || !name) throw new UserError("代碼與名稱必填");
  return { code, name, note: optStr(fd, "note"), sortOrder: intVal(fd, "sortOrder"), active: bool(fd, "active") };
}

async function addWarehouse(fd: FormData) {
  "use server";
  await requireUser();
  await attempt("/warehouses", () => prisma.warehouse.create({ data: read(fd) }));
  await audit("/warehouses", "已新增庫別", String(fd.get("name") ?? ""));
  revalidatePath("/", "layout");
}

async function saveWarehouse(id: number, fd: FormData) {
  "use server";
  await requireUser();
  await attempt("/warehouses", () => prisma.warehouse.update({ where: { id }, data: read(fd) }));
  await audit("/warehouses", "已修改庫別", String(fd.get("name") ?? ""));
  revalidatePath("/", "layout");
}

export default async function WarehousesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const list = await prisma.warehouse.findMany({ orderBy: [{ sortOrder: "asc" }, { id: "asc" }] });
  const row = (w?: (typeof list)[number]) => (
    <>
      <input name="code" defaultValue={w?.code} placeholder="代碼" className="input w-24" />
      <input name="name" defaultValue={w?.name} placeholder="名稱，例：護理部" className="input" />
      <input name="note" defaultValue={w?.note ?? ""} placeholder="備註" className="input" />
      <input name="sortOrder" type="number" defaultValue={w?.sortOrder ?? 0} className="input w-20" title="排序" />
      <label className="flex items-center gap-1 text-sm whitespace-nowrap">
        <input type="checkbox" name="active" defaultChecked={w?.active ?? true} /> 使用中
      </label>
    </>
  );
  return (
    <div className="max-w-4xl">
      <PageHeader title="庫別（部門）" />
      <p className="mb-4 text-sm text-slate-500">每個部門一個庫別，各自管理庫存。需要時可以在「庫別調撥」互相移轉。</p>
      <Flash sp={sp} />
      <div className="card space-y-2">
        {list.map((w) => (
          <form key={w.id} action={saveWarehouse.bind(null, w.id)} className="flex flex-wrap items-center gap-2">
            {row(w)}
            <button className="btn-secondary">儲存</button>
          </form>
        ))}
        <form action={addWarehouse} className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          {row()}
          <button className="btn">新增</button>
        </form>
      </div>
    </div>
  );
}
