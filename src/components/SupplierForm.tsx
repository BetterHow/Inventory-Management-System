import type { Supplier } from "@prisma/client";
import { Field, CancelLink } from "./ui";

export function SupplierForm({ s, action }: { s?: Supplier; action: (fd: FormData) => Promise<void> }) {
  return (
    <form action={action} className="card grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2">
      <Field label="名稱 *"><input name="name" className="input" defaultValue={s?.name} required /></Field>
      <Field label="統一編號"><input name="taxId" className="input" defaultValue={s?.taxId ?? ""} /></Field>
      <Field label="聯絡人"><input name="contact" className="input" defaultValue={s?.contact ?? ""} /></Field>
      <Field label="電話"><input name="phone" className="input" defaultValue={s?.phone ?? ""} /></Field>
      <Field label="付款條件（例：月結30天）"><input name="paymentTerms" className="input" defaultValue={s?.paymentTerms ?? ""} /></Field>
      <Field label="備註"><input name="note" className="input" defaultValue={s?.note ?? ""} /></Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={s?.active ?? true} /> 使用中
      </label>
      <div className="flex gap-2 sm:col-span-2"><button className="btn">儲存</button><CancelLink href="/suppliers" /></div>
    </form>
  );
}
