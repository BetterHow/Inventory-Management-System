import type { Item, Category, Supplier } from "@prisma/client";
import { Field, CancelLink, OwnerSelect } from "./ui";
import { num, fmtDate } from "@/lib/format";
import { PriceFields } from "./PriceFields";
import { BarcodeField } from "./BarcodeField";

export function ItemForm({ item, categories, suppliers, action, cancelHref = "/items", owners, defaultOwner, readOnly, ownerName }: {
  owners: { id: number; name: string }[]; // departments this person may assign
  defaultOwner?: number | null;
  readOnly?: boolean; // owned by a department this person can only view
  ownerName?: string;
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
      <Field label="國際條碼（掃描槍或相機）"><BarcodeField defaultValue={item?.barcode ?? ""} /></Field>
      <Field label="搜尋關鍵字（可填多個，用空白或逗號分開）" className="sm:col-span-2">
        <input name="keywords" className="input" defaultValue={item?.keywords ?? ""} placeholder="例如 BET BETA NEO（成分名、俗名、商品名，跟方鼎的藥品索引一樣）" />
      </Field>
      <Field label="規格"><input name="spec" className="input" defaultValue={item?.spec ?? ""} /></Field>
      <Field label="參考單價（含稅）">
        <input name="refPrice" type="number" step="0.01" className="input" defaultValue={item?.refPrice ? num(item.refPrice) : ""} />
      </Field>
      <Field label="預設供應商">
        <select name="defaultSupplierId" className="input" defaultValue={item?.defaultSupplierId ?? ""}>
          <option value="">（無）</option>
          {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>
      <Field label="備註"><input name="note" className="input" defaultValue={item?.note ?? ""} /></Field>
      <OwnerSelect value={item ? item.ownerWarehouseId : defaultOwner} warehouses={owners} locked={readOnly ? ownerName : undefined} />
      <PriceFields
        source={item?.priceSource ?? (item?.nhiCode ? "NHI" : "MANUAL")}
        salePrice={item?.salePrice == null ? null : num(item.salePrice)}
        nhiPrice={item?.nhiPrice == null ? null : num(item.nhiPrice)}
        nhiPriceFrom={item?.nhiPriceFrom ? fmtDate(item.nhiPriceFrom, true) : null}
        nhiCheckedAt={item?.nhiCheckedAt ? fmtDate(item.nhiCheckedAt, true) : null}
      />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="trackBatch" defaultChecked={item?.trackBatch ?? true} /> 管理批號與效期
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={item?.active ?? true} /> 使用中（取消勾選即停用）
      </label>
      <div className="flex items-center gap-2 sm:col-span-2">
        {readOnly ? <span className="text-sm text-amber-700">這個品項由「{ownerName}」維護，你只能查看。</span> : <button className="btn">儲存</button>}
        <CancelLink href={cancelHref} label={readOnly ? "返回" : "取消"} />
      </div>
    </form>
  );
}
