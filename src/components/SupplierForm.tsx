import type { Supplier } from "@prisma/client";
import { Field, CancelLink, OwnerSelect } from "./ui";

export function SupplierForm({ s, action, owners, defaultOwner, readOnly, ownerName, categories }: {
  s?: Supplier; action: (fd: FormData) => Promise<void>;
  owners: { id: number; name: string }[]; defaultOwner?: number | null; readOnly?: boolean; ownerName?: string; categories: string[];
}) {
  return (
    <form action={action} className="card grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="名稱 *"><input name="name" className="input" defaultValue={s?.name} required /></Field>
      <Field label="統一編號"><input name="taxId" className="input" defaultValue={s?.taxId ?? ""} /></Field>
      <Field label="聯絡人"><input name="contact" className="input" defaultValue={s?.contact ?? ""} /></Field>
      <Field label="電話"><input name="phone" className="input" defaultValue={s?.phone ?? ""} /></Field>
      <Field label="付款條件（例：月結30天）"><input name="paymentTerms" className="input" defaultValue={s?.paymentTerms ?? ""} /></Field>
      <Field label="備註"><input name="note" className="input" defaultValue={s?.note ?? ""} /></Field>
      <Field label="分類（例：藥商、耗材、鏡片）">
        <input name="category" className="input" list="supplier-categories" defaultValue={s?.category ?? ""} placeholder="選擇或自行輸入" />
        <datalist id="supplier-categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
      </Field>
      <OwnerSelect value={s ? s.ownerWarehouseId : defaultOwner} warehouses={owners} locked={readOnly ? ownerName : undefined} />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> 使用中
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        {readOnly ? <span className="text-sm text-amber-700">這個供應商由「{ownerName}」維護，你只能查看。</span> : <button className="btn">儲存</button>}
        <CancelLink href="/suppliers" label={readOnly ? "返回" : "取消"} />
      </div>
    </form>
  );
}
