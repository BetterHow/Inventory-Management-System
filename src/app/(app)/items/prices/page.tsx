import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
import { Flash } from "@/components/Flash";
import { getSettings } from "@/lib/settings";
import { NhiImport } from "@/components/NhiImport";

export default async function NhiPricesPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const [items, settings] = await Promise.all([
    prisma.item.findMany({ where: { active: true }, select: { nhiCode: true, priceSource: true } }),
    getSettings(),
  ]);
  const codes = [...new Set(items.map((i) => i.nhiCode?.trim().toUpperCase()).filter(Boolean) as string[])];
  const following = items.filter((i) => i.priceSource === "NHI").length;
  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader title="健保價更新" description={<>有填健保碼的品項 {codes.length} 個，其中 {following} 個設定為「跟著健保價自動更新」。</>}>
        <Link href="/items" className="btn-secondary">回品項</Link>
      </PageHeader>
      <Flash sp={sp} />
      <div className="card space-y-2 text-sm text-slate-600">
        <p><b className="text-slate-800">怎麼運作：</b>用每個品項的「健保碼」去對健保署的價格檔。</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>設定為「跟著健保價自動更新」的品項：售價會改成新的健保價，並從生效日起算價差。</li>
          <li>設定為「手動輸入」的品項：只記下最新健保價供參考，售價不會被改。</li>
          <li>健保署沒有的品項（自費、部分耗材），請在品項頁選「手動輸入」自己填。</li>
          <li>價格檔可在健保署「健保用藥品項查詢」或政府資料開放平台「健保用藥品項」下載；特材另有特材品項檔，兩個都能匯入。檔案若是 zip 請先解壓縮。</li>
        </ul>
      </div>
      <NhiImport codes={codes} savedUrl={settings.nhiPriceUrl} />
    </div>
  );
}
