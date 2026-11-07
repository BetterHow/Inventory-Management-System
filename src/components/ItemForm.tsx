import type { Item, Category, Supplier } from "@prisma/client";
import { Field, CancelLink } from "./ui";
import { num } from "@/lib/format";

export function ItemForm({ item, categories, suppliers, action, cancelHref = "/items" }: {
  item?: Item;
  categories: Category[];
  suppliers: Supplier[];
  action: (fd: FormData) => Promise<void>;
  cancelHref?: string;
}) {
  return (
    <form action={action} className="card grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="料號 *"><input name="code" className="input" defaultValue={item?.code} required /></Field>
      <Field label="品名 *"><input name="name" className="input" defaultValue={item?.name} required /></Field>
      <Field label="類別">
        <select name="categoryId" className="input" defaultValue={item?.categoryId ?? ""}>
          <option value="">（未分類）</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </Field>
      <Field label="單位"><input name="unit" className="input" defaultValue={item?.unit ?? "個"} /></Field>
      <Field label="健保碼"><input name="nhiCode" className="input" defaultValue={item?.nhiCode ?? ""} /></Field>
      <Field label="國際條碼（可用掃描槍）"><input name="barcode" className="input" defaultValue={item?.barcode ?? ""} /></Field>
      <Field label="規格"><input name="spec" className="input" defaultValue={item?.spec ?? ""} /></Field>
      <Field label="參考單價（含稅）">
        <input name="refPrice" type="number" step="0.01" className="input" defaultValue={item?.refPrice ? num(item.refPrice) : ""} />
      </Field>
      <Field label="健保價／售價（每單位）">
        <input name="salePrice" type="number" step="0.01" className="input" defaultValue={item?.salePrice ? num(item.salePrice) : ""} placeholder="用來算價差，可留空" />
      </Field>
      <Field label="預設供應商">
        <select name="defaultSupplierId" className="input" defaultValue={item?.defaultSupplierId ?? ""}>
          <option value="">（無）</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="備註"><input name="note" className="input" defaultValue={item?.note ?? ""} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="trackBatch" defaultChecked={item?.trackBatch ?? true} /> 管理批號與效期
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> 使用中（取消勾選即停用）
      </label>
      <div className="flex gap-2 sm:col-span-2"><button className="btn">儲存</button><CancelLink href={cancelHref} /></div>
    </form>
  );
}
