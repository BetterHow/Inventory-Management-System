import Link from "next/link";
import { AutoForm } from "@/components/AutoForm";
import { prisma } from "@/lib/db";
import { PageHeader, Field, Empty } from "@/components/ui";
import { buildReport, defaultParams } from "@/lib/reports";
import { activeWarehouses } from "@/lib/pickers";

const TABS: [string, string][] = [
  ["consumption", "耗用"],
  ["receiving", "進貨"],
  ["stock", "庫存金額"],
  ["expiry", "效期"],
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const p = defaultParams(sp);
  const [report, warehouses, categories] = await Promise.all([
    buildReport(p),
    activeWarehouses(),
    prisma.category.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const qs = new URLSearchParams(Object.entries(p).filter(([, v]) => v !== undefined) as [string, string][]);
  const fmt = (v: string | number) => (typeof v === "number" ? v.toLocaleString("zh-TW", { maximumFractionDigits: 2 }) : v);
  const usesRange = p.tab === "consumption" || p.tab === "receiving";

  return (
    <div>
      <PageHeader title="報表">
        <a href={`/api/export?${qs}`} className="btn-secondary">匯出 Excel</a>
      </PageHeader>
      <div className="mb-3 flex flex-wrap gap-1 text-sm">
        {TABS.map(([v, l]) => (
          <Link key={v} href={`/reports?tab=${v}`} className={`rounded-full px-3 py-1 ${p.tab === v ? "bg-teal-600 text-white" : "border border-slate-200 bg-white"}`}>{l}</Link>
        ))}
      </div>
      <AutoForm className="card mb-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="tab" value={p.tab} />
        <Field label="庫別">
          <select name="warehouse" defaultValue={p.warehouse} className="input">
            <option value="all">全部</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </Field>
        {usesRange && (
          <>
            <Field label="起"><input type="date" name="from" defaultValue={p.from} className="input" /></Field>
            <Field label="迄"><input type="date" name="to" defaultValue={p.to} className="input" /></Field>
            <Field label="週期">
              <select name="g" defaultValue={p.g} className="input">
                <option value="day">日</option><option value="week">週</option><option value="month">月</option>
                <option value="quarter">季</option><option value="year">年</option>
              </select>
            </Field>
          </>
        )}
        {p.tab === "consumption" && (
          <>
            <Field label="顯示">
              <select name="measure" defaultValue={p.measure} className="input"><option value="qty">數量</option><option value="amount">金額</option></select>
            </Field>
            <Field label="類別">
              <select name="category" defaultValue={p.category ?? ""} className="input">
                <option value="">全部</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
          </>
        )}
        {p.tab === "expiry" && (
          <Field label="幾天內到期"><input type="number" name="days" defaultValue={p.days} className="input w-24" /></Field>
        )}
      </AutoForm>
      <h2 className="mb-2 font-semibold">{report.title}</h2>
      <div className="card overflow-x-auto p-0">
        {report.rows.length === 0 ? <Empty>這個條件沒有資料</Empty> : (
          <table className="table">
            <thead><tr>{report.headers.map((h, i) => <th key={i} className={i >= report.numericFrom ? "num" : ""}>{h}</th>)}</tr></thead>
            <tbody>
              {report.rows.map((r, i) => (
                <tr key={i}>{r.map((c, j) => <td key={j} className={j >= report.numericFrom ? "num" : ""}>{j >= report.numericFrom && c === 0 ? "" : fmt(c)}</td>)}</tr>
              ))}
            </tbody>
            {report.totals && (
              <tfoot><tr>{report.totals.map((c, j) => <td key={j} className={`font-semibold ${j >= report.numericFrom ? "num" : ""}`}>{fmt(c)}</td>)}</tr></tfoot>
            )}
          </table>
        )}
      </div>
    </div>
  );
}
