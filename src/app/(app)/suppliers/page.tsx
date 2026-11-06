import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, LinkButton, Empty } from "@/components/ui";
import { Flash } from "@/components/Flash";

export default async function SuppliersPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const suppliers = await prisma.supplier.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return (
    <div>
      <PageHeader title="供應商"><LinkButton href="/suppliers/new">＋ 新增供應商</LinkButton></PageHeader>
      <Flash sp={sp} />
      <div className="card overflow-x-auto p-0">
        {suppliers.length === 0 ? <Empty>還沒有供應商</Empty> : (
          <table className="table">
            <thead><tr><th>名稱</th><th>統編</th><th>聯絡人</th><th>電話</th><th>付款條件</th><th>狀態</th></tr></thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/suppliers/${s.id}`} className="btn-link">{s.name}</Link></td>
                  <td>{s.taxId}</td><td>{s.contact}</td><td>{s.phone}</td><td>{s.paymentTerms}</td>
                  <td>{s.active ? "" : <span className="badge bg-slate-200">停用</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
