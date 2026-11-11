"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ClipboardPaste, FileUp, Loader2, AlertTriangle } from "lucide-react";
import { decodeText } from "@/lib/nhiParse";
import { parseHisTable, parseHisText, PRICE_TYPE_LABEL, type HisParse, type PriceType } from "@/lib/hisParse";
import { applyImport, previewImport, type HisPreview } from "@/app/(app)/consumption/import/actions";

const money = (n: number) => Math.round(n).toLocaleString("zh-TW");
const qtyFmt = (n: number) => (Math.round(n * 100) / 100).toLocaleString("zh-TW");

const TYPE_COLOR: Record<PriceType, string> = {
  NHI: "bg-sky-50 text-sky-700 ring-sky-200",
  SELF: "bg-violet-50 text-violet-700 ring-violet-200",
  FREE: "bg-slate-100 text-slate-600 ring-slate-200",
};

async function readFile(file: File): Promise<HisParse> {
  const buf = new Uint8Array(await file.arrayBuffer());
  if (/\.xlsx$/i.test(file.name) || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const table: string[][] = [];
    wb.worksheets[0].eachRow((row) =>
      table.push((row.values as unknown[]).slice(1).map((v) => (v && typeof v === "object" && "result" in v ? String((v as { result: unknown }).result) : String(v ?? "")))),
    );
    return parseHisTable(table);
  }
  return parseHisText(decodeText(buf));
}

export function HisImport({ warehouses, defaultWarehouseId, today }: { warehouses: { id: number; name: string }[]; defaultWarehouseId?: number; today: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [warehouseId, setWarehouseId] = useState<number>(defaultWarehouseId ?? warehouses[0]?.id);
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [paste, setPaste] = useState("");
  const [preview, setPreview] = useState<HisPreview | null>(null);
  // Keyed by 藥品代號: picking an item or factor for one row applies to every row of the same code.
  const [edits, setEdits] = useState<Record<string, { itemId?: number | null; factor?: number }>>({});

  function load(parsed: HisParse, name: string | null) {
    setError(null);
    setResult(null);
    if (parsed.error) return setError(parsed.error);
    const f = parsed.from ?? from, t = parsed.to ?? parsed.from ?? to;
    setFrom(f); setTo(t); setFileName(name); setEdits({});
    start(async () => setPreview(await previewImport(parsed.rows, warehouseId, f, t)));
  }

  const rows = useMemo(() => (preview?.rows ?? []).map((r) => ({ ...r, ...edits[r.code] })), [preview, edits]);
  const itemById = useMemo(() => new Map((preview?.items ?? []).map((i) => [i.id, i])), [preview]);
  const unmatched = rows.filter((r) => !r.itemId);
  const byType = (["NHI", "SELF", "FREE"] as PriceType[]).map((t) => {
    const list = rows.filter((r) => r.priceType === t && r.itemId);
    return { t, n: list.length, amount: list.reduce((s, r) => s + r.amount, 0) };
  });

  function apply() {
    if (!preview) return;
    start(async () => {
      const r = await applyImport({
        rows: rows.map((x) => ({ code: x.code, name: x.name, price: x.price, qty: x.qty, amount: x.amount, hisCost: x.hisCost, rx: x.rx, itemId: x.itemId, factor: x.factor })),
        warehouseId, from, to, fileName,
      });
      if ("error" in r) return setError(r.error ?? "匯入失敗");
      setPreview(null);
      setPaste("");
      setResult(`已匯入 ${r.count} 筆並扣庫${r.skipped ? `，${r.skipped} 筆沒有對應品項而略過` : ""}。${r.warnings.length ? `注意：${r.warnings.join("、")}，已變成負庫存。` : ""}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><FileUp className="size-4 text-teal-600" />上傳報表檔</h2>
          <p className="text-xs text-slate-500">方鼎「藥品耗用統計表」匯出的 Excel、CSV，或印到「Generic / Text Only」印表機得到的 TXT。系統會自己找「藥品代號、單價、用量、合計」欄和統計期間。</p>
          <input type="file" accept=".csv,.txt,.xlsx,.prn" disabled={busy}
            onChange={async (e) => { const f = e.target.files?.[0]; if (f) load(await readFile(f), f.name); e.target.value = ""; }}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-teal-700" />
        </section>
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><ClipboardPaste className="size-4 text-teal-600" />或貼上報表文字</h2>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={3} placeholder="從報表複製整頁貼上（含欄位名稱那一列）" className="input font-mono text-xs" />
          <button type="button" className="btn-secondary" disabled={busy || !paste.trim()} onClick={() => load(parseHisText(paste), null)}>讀取貼上的內容</button>
        </section>
      </div>

      <section className="card grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="label">扣哪個庫別</span>
          <select value={warehouseId} onChange={(e) => { setWarehouseId(Number(e.target.value)); setPreview(null); }} className="input">
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </label>
        <label className="block"><span className="label">報表期間（自動帶入）</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" /></label>
        <label className="block"><span className="label">到（扣庫日期）</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" /></label>
      </section>

      {busy && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />處理中⋯</p>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}
      {result && <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800"><CheckCircle2 className="mt-0.5 size-4 shrink-0" />{result}</div>}

      {preview && !busy && (
        <section className="card space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">確認內容</h2>
              <p className="text-sm text-slate-500">{rows.length} 列{fileName ? `，來自 ${fileName}` : ""}。收入用報表的「合計」，成本用進貨批次的單價（先到期先扣）。</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm">
              {byType.map((b) => (
                <span key={b.t} className={`badge ring-1 ring-inset ${TYPE_COLOR[b.t]}`}>{PRICE_TYPE_LABEL[b.t]} {b.n} 列・${money(b.amount)}</span>
              ))}
            </div>
          </div>

          {preview.overlap.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              這個庫別在 {preview.overlap.map((o) => (o.from === o.to ? o.from : `${o.from}～${o.to}`)).join("、")} 已經匯入過。再匯入會重複扣庫，請確認不是同一份報表。
            </div>
          )}
          {unmatched.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900">
              有 <b>{unmatched.length}</b> 列對不到品項（標黃色）。請在「對應品項」選一下，系統會記住，下次自動對上。不選的列不會扣庫。
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="table">
              <thead>
                <tr><th>藥品代號</th><th>報表品名</th><th>對應品項</th><th className="num">單價</th><th>價別</th><th className="num">用量</th><th className="num" title="報表 1 單位 = 庫存幾單位">換算</th><th className="num">扣庫</th><th className="num">合計</th><th className="num">開藥次</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const it = r.itemId ? itemById.get(r.itemId) : undefined;
                  return (
                    <tr key={r.key} className={r.itemId ? "" : "bg-amber-50/60"}>
                      <td className="font-mono text-xs">{r.code}</td>
                      <td className="max-w-[14rem] truncate" title={r.name}>{r.name}</td>
                      <td>
                        <select value={r.itemId ?? ""} onChange={(e) => setEdits({ ...edits, [r.code]: { ...edits[r.code], itemId: e.target.value ? Number(e.target.value) : null } })}
                          className="input min-w-[12rem] py-1 text-sm">
                          <option value="">（不扣庫）</option>
                          {preview.items.map((i) => <option key={i.id} value={i.id}>{i.code} {i.name}{i.keywords ? `（${i.keywords}）` : ""}</option>)}
                        </select>
                        {r.matchedBy && r.matchedBy !== "map" && !edits[r.code]?.itemId && <div className="mt-0.5 text-[11px] text-slate-400">依{r.matchedBy === "nhi" ? "健保碼" : r.matchedBy === "code" ? "料號" : "條碼"}自動對應</div>}
                      </td>
                      <td className="num">{r.price.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}</td>
                      <td><span className={`badge ring-1 ring-inset ${TYPE_COLOR[r.priceType]}`} title={r.nhiPrice != null ? `健保價 ${r.nhiPrice}` : r.guessed ? "系統還沒有這個品項的健保價，用報表上的最低價推估為健保" : "沒有健保價資料"}>{PRICE_TYPE_LABEL[r.priceType]}{r.guessed && r.priceType !== "FREE" ? "（推估）" : ""}</span></td>
                      <td className="num">{qtyFmt(r.qty)}</td>
                      <td className="num">
                        <input type="number" step="0.0001" min="0" value={r.factor} onChange={(e) => setEdits({ ...edits, [r.code]: { ...edits[r.code], factor: Number(e.target.value) || 1 } })}
                          className="input w-20 py-1 text-right text-sm" />
                      </td>
                      <td className="num whitespace-nowrap">{it ? `${qtyFmt(r.qty * r.factor)} ${it.unit}` : "—"}</td>
                      <td className="num">{money(r.amount)}</td>
                      <td className="num">{r.rx ?? ""}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">價別自動歸類：0 元＝贈送；等於健保價＝健保；其他價格＝自費（含優惠）。系統還沒有健保價的品項，用報表上同品項的最低價當健保（標「推估」），到「健保價更新」匯入健保署檔案後就會變準。只影響統計分布，獲利一律用報表的實際金額計算。換算：例如報表以「粒」計、庫存以「盒（100 粒）」計，就填 0.01。</p>
          <div className="flex gap-2">
            <button type="button" onClick={apply} disabled={busy || rows.length === unmatched.length} className="btn">確認扣庫 {rows.length - unmatched.length} 列</button>
            <button type="button" onClick={() => setPreview(null)} className="btn-secondary">取消</button>
          </div>
        </section>
      )}
    </div>
  );
}
