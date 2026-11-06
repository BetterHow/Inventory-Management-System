import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/SupplierForm";
import { Flash } from "@/components/Flash";
import { createSupplier } from "../actions";

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (<div><PageHeader title="新增供應商" /><Flash sp={sp} /><SupplierForm action={createSupplier} /></div>);
}
