import { requireAdmin } from "@/lib/auth";
import { buildDigest, digestHtml, digestSubject } from "@/lib/digest";
import { PageHeader, CancelLink } from "@/components/ui";

/** What today's reminder mail would look like. Nothing is sent. */
export default async function DigestPreview() {
  await requireAdmin();
  const d = await buildDigest();
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title="每日提醒預覽"><CancelLink href="/settings#digest" label="回設定" /></PageHeader>
      <p className="text-sm text-slate-500">主旨：{digestSubject(d)}</p>
      <div className="card bg-white" dangerouslySetInnerHTML={{ __html: digestHtml(d) }} />
    </div>
  );
}
