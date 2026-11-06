import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { SupplierForm } from "@/components/SupplierForm";
import { Flash } from "@/components/Flash";
import { updateSupplier } from "../actions";

export default async function Page({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const s = await prisma.supplier.findUnique({ where: { id: Number(id) } });
  if (!s) notFound();
  return (<div><PageHeader title={`供應商：${s.name}`} /><Flash sp={sp} /><SupplierForm s={s} action={updateSupplier.bind(null, s.id)} /></div>);
}
