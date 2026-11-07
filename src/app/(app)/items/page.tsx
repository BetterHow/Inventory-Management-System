import Link from "next/link";
import { AutoForm } from "@/components/AutoForm";
import { prisma } from "@/lib/db";
import { PageHeader, LinkButton, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { fmtMoney } from "@/lib/format";

type SP = Promise<Record<string, string | undefined>>;

export default async function ItemsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const cat = sp.cat ? Number(sp.cat) : undefined;
  const showInactive = sp.inactive === "1";
  const [items, categories] = await Promise.all([
    prisma.item.findMany({
      where: {
        ...(showInactive ? {} : { active: true }),
        ...(cat ? { categoryId: cat } : {}),
        ...(q
          ? { OR: ["code", "name", "nhiCode", "barcode"].map((f) => ({ [f]: { contains: q, mode: "insensitive" as const } })) }
          : {}),
      },
      include: { category: true, defaultSupplier: true },
      orderBy: { code: "asc" },
    }),
    prisma.category.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
  ]);

  return (
    <div>
      <PageHeader title="品項">
        <LinkButton href="/items/prices" secondary>健保價更新</LinkButton>
        <LinkButton href="/items/new">＋ 新增品項</LinkButton>
      </PageHeader>
      <Flash sp={sp} />
      <AutoForm className="mb-4 flex flex-wrap items-end gap-2">
        <input name="q" defaultValue={q} placeholder="搜尋料號、品名、健保碼、條碼" className="input max-w-xs" />
        <select name="cat" defaultValue={sp.cat ?? ""} className="input max-w-[10rem]">
          <option value="">全部類別</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="flex items-center gap-1 text-sm">
          <input type="checkbox" name="inactive" value="1" defaultChecked={showInactive} /> 含停用
        </label>
      </AutoForm>
      <div className="card overflow-x-auto p-0">
        {items.length === 0 ? (
          <Empty>還沒有品項</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>料號</th><th>品名</th><th>類別</th><th>單位</th><th>健保碼</th><th>條碼</th>
                <th className="num">參考單價</th><th className="num">健保價／售價</th><th>預設供應商</th><th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td><Link href={`/items/${i.id}`} className="btn-link">{i.code}</Link></td>
                  <td>{i.name}{i.spec && <span className="text-slate-400"> {i.spec}</span>}</td>
                  <td>{i.category?.name}</td>
                  <td>{i.unit}</td>
                  <td>{i.nhiCode}</td>
                  <td>{i.barcode}</td>
                  <td className="num">{i.refPrice ? fmtMoney(i.refPrice) : ""}</td>
                  <td className="num">{i.salePrice ? fmtMoney(i.salePrice) : ""}</td>
                  <td>{i.defaultSupplier?.name}</td>
                  <td>{i.active ? "" : <span className="badge bg-slate-200">停用</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="mt-2 text-xs text-slate-400">共 {items.length} 項</p>
    </div>
  );
}
