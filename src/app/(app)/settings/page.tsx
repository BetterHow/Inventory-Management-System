import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getSettings, saveSettings } from "@/lib/settings";
import { bool, intVal, str } from "@/lib/form";
import { PageHeader, Field } from "@/components/ui";
import { Flash } from "@/components/Flash";

async function save(fd: FormData) {
  "use server";
  await requireAdmin();
  await saveSettings({
    clinicName: str(fd, "clinicName") || "診所",
    inspectionEnabled: bool(fd, "inspectionEnabled"),
    expiryWarnDays: intVal(fd, "expiryWarnDays"),
    expiryDangerDays: intVal(fd, "expiryDangerDays"),
    usageDays: Math.max(7, intVal(fd, "usageDays")),
  });
  revalidatePath("/", "layout");
  redirect("/settings?ok=" + encodeURIComponent("已儲存設定"));
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
        <button className="btn">儲存</button>
      </form>
    </div>
  );
}
