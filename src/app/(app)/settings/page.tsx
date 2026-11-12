import { done } from "@/lib/action";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSettings, saveSettings, splitLines } from "@/lib/settings";
import { bool, intVal, str } from "@/lib/form";
import { PageHeader, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";
import Link from "@/components/Link";
import { mailReady, sendDigest } from "@/lib/digest";

async function save(fd: FormData) {
  "use server";
  await requireAdmin();
  const s0 = await getSettings();
  await saveSettings({
    clinicName: str(fd, "clinicName") || "診所",
    inspectionEnabled: bool(fd, "inspectionEnabled"),
    expiryWarnDays: intVal(fd, "expiryWarnDays"),
    expiryDangerDays: intVal(fd, "expiryDangerDays"),
    usageDays: Math.max(7, intVal(fd, "usageDays")),
    consumptionNotes: splitLines(str(fd, "consumptionNotes")),
    noRevenueNotes: splitLines(str(fd, "noRevenueNotes")),
    nhiPriceUrl: s0.nhiPriceUrl,
    digestEnabled: bool(fd, "digestEnabled"),
    digestEmails: splitLines(str(fd, "digestEmails").replace(/[,;，、\s]+/g, "\n")).filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
    digestSkipEmpty: bool(fd, "digestSkipEmpty"),
  });
  revalidatePath("/", "layout");
  return done("/settings", "已儲存設定");
}

async function testDigest() {
  "use server";
  await requireAdmin();
  const r = await sendDigest(true);
  if (!r.sent) redirect(`/settings?error=${encodeURIComponent(`測試信沒有寄出：${r.reason}`)}#digest`);
  return done("/settings", "測試信已寄出", r.to?.join("、"));
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const s = await getSettings();
  return (
    <div className="max-w-xl">
      <PageHeader title="系統設定" />
      <Flash sp={sp} />
      <form action={save} className="card space-y-4">
        <Field label="診所名稱（顯示在左上角）"><input name="clinicName" defaultValue={s.clinicName} className="input" /></Field>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="inspectionEnabled" defaultChecked={s.inspectionEnabled} className="mt-1" />
          <span>
            <b>進貨需要驗收</b>
            <br />
            <span className="text-slate-500">開啟：進貨單到貨後先「待驗收」，有人按驗收才入庫。關閉：進貨單存檔即入庫。</span>
          </span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="效期提醒（天內顯示黃色）"><input name="expiryWarnDays" type="number" defaultValue={s.expiryWarnDays} className="input" /></Field>
          <Field label="效期警示（天內顯示紅色）"><input name="expiryDangerDays" type="number" defaultValue={s.expiryDangerDays} className="input" /></Field>
        </div>
        <Field label="自動安全量參考最近幾天的耗用">
          <input name="usageDays" type="number" defaultValue={s.usageDays} className="input" />
        </Field>
        <Field label="耗用備註的常用選項（一行一個）">
          <textarea name="consumptionNotes" rows={6} defaultValue={s.consumptionNotes.join("\n")} className="input" />
        </Field>
        <Field label="不算售價的用途（一行一個；備註含這些字的耗用，只算成本不算售價）">
          <textarea name="noRevenueNotes" rows={4} defaultValue={s.noRevenueNotes.join("\n")} className="input" />
        </Field>
        <fieldset id="digest" className="space-y-3 rounded-lg border border-slate-200 p-4">
          <legend className="px-1 text-sm font-semibold text-slate-900">每日提醒信</legend>
          <p className="text-xs text-slate-500">每天早上 8 點寄一封信，列出各部門庫存不足（不到 1 個月）、近效期的批號，和還沒入庫的進貨單。</p>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="digestEnabled" defaultChecked={s.digestEnabled} /> 開啟每日提醒</label>
          <Field label="收件人 Email（一行一個）">
            <textarea name="digestEmails" rows={3} defaultValue={s.digestEmails.join("\n")} placeholder="name@example.com" className="input" />
          </Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="digestSkipEmpty" defaultChecked={s.digestSkipEmpty} /> 當天沒有要提醒的事就不寄</label>
          {!mailReady() && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">還沒設定寄信金鑰，所以目前不會寄信。收件人可以先填好，設定方式見 README 的「每日提醒信」。</p>}
          <p className="text-xs text-slate-500"><Link href="/settings/digest" className="text-teal-700 underline">預覽今天的提醒內容</Link></p>
        </fieldset>
        <button className="btn">儲存</button>
      </form>
      <form action={testDigest} className="mt-3">
        <button className="btn-secondary" disabled={!mailReady()}>寄一封測試信給收件人</button>
        <span className="ml-2 text-xs text-slate-500">先按上面的「儲存」再寄。</span>
      </form>
    </div>
  );
}
