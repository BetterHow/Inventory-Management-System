"use client";
import { useState, useTransition } from "react";
import { FileUp, Link2, Loader2 } from "lucide-react";
import { decodeText, parseNhiTable, textToTable, type NhiRow } from "@/lib/nhiParse";
import { applyRows, previewRows, previewUrl, type Preview } from "@/app/(app)/items/prices/actions";

const money = (n: number | null) => (n == null ? "—" : n.toLocaleString("zh-TW"));

async function readFile(file: File): Promise<{ rows: NhiRow[]; error?: string }> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  if (/\.xlsx$/i.test(file.name) || isZip) {
    if (!/\.xlsx$/i.test(file.name)) return { rows: [], error: "這是壓縮檔（zip），請先解壓縮再上傳裡面的檔案。" };
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf.buffer as ArrayBuffer);
    const table: string[][] = [];
    wb.worksheets[0].eachRow((row) =>
      table.push((row.values as unknown[]).slice(1).map((v) => (v && typeof v === "object" && "result" in v ? String((v as { result: unknown }).result) : String(v ?? "")))),
    );
    return parseNhiTable(table);
  }
  return parseNhiTable(textToTable(decodeText(buf)));
}

export function NhiImport({ codes, savedUrl }: { codes: string[]; savedUrl: string }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [url, setUrl] = useState(savedUrl);
  const [busy, start] = useTransition();
  const known = new Set(codes);

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    start(async () => {
      const { rows, error } = await readFile(file);
      if (error) return setError(error);
      // Only send the codes we use: the full file can be tens of MB.
      const mine = rows.filter((r) => known.has(r.code));
      const p = await previewRows(mine, file.name);
      setPreview({ ...p, fileRows: rows.length });
    });
  }
  function onUrl() {
    setError(null);
    start(async () => {
      const p = await previewUrl(url.trim());
      if (p.error) setError(p.error);
      else setPreview(p);
    });
  }

  const following = preview?.changes.filter((c) => c.source === "NHI") ?? [];
  const missing = preview?.notFound.filter((n) => n.source === "NHI") ?? [];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><FileUp className="size-4 text-teal-600" />上傳健保署檔案</h2>
          <p className="text-xs text-slate-500">CSV、TXT 或 Excel 都可以。系統會自己找「藥品代號／健保碼」和「參考價／支付點數」欄。</p>
          <input type="file" accept=".csv,.txt,.xlsx" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-teal-600 file:px-3.5 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-teal-700" />
        </section>
        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 font-semibold text-slate-900"><Link2 className="size-4 text-teal-600" />從網址更新</h2>
          <p className="text-xs text-slate-500">貼上健保署價格檔的下載網址。網址會記住，之後健保調價時按一下就能更新。</p>
          <div className="flex gap-2">
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" className="input" />
            <button type="button" onClick={onUrl} disabled={busy || !url.trim()} className="btn">下載並比對</button>
          </div>
        </section>
      </div>

      {busy && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="size-4 animate-spin" />讀取中⋯ 大檔案可能要十幾秒</p>}
      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">{error}</div>}

      {preview && !busy && (
        <section className="card space-y-4">
          <div>
            <h2 className="font-semibold text-slate-900">比對結果</h2>
            <p className="text-sm text-slate-500">
              檔案共 {preview.fileRows.toLocaleString()} 筆。對到 {preview.changes.length + preview.same.length} 個品項：
              {preview.changes.length} 個價格有變、{preview.same.length} 個沒變。
            </p>
          </div>
          {preview.changes.length > 0 ? (
            <form action={async (fd) => { await applyRows(fd); setPreview(null); }} className="space-y-3">
              <input type="hidden" name="changes" value={JSON.stringify(preview.changes.map((c) => ({ itemId: c.itemId, price: c.price, from: c.from })))} />
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="table">
                  <thead><tr><th>品項</th><th>健保碼</th><th>價格來源</th><th className="num">目前</th><th className="num">新健保價</th><th>生效日</th></tr></thead>
                  <tbody>
                    {preview.changes.map((c) => (
                      <tr key={c.itemId}>
                        <td>{c.name} <span className="text-xs text-slate-400">{c.code}</span></td>
                        <td>{c.nhiCode}</td>
                        <td>{c.source === "NHI" ? <span className="badge bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200">自動更新</span> : <span className="badge bg-slate-100 text-slate-500">手動（只記錄）</span>}</td>
                        <td className="num">{money(c.old)}</td>
                        <td className={`num font-medium ${c.old != null && c.price < c.old ? "text-rose-600" : "text-slate-900"}`}>{money(c.price)}</td>
                        <td>{c.from ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button className="btn">確認更新 {preview.changes.length} 個品項{following.length ? `（${following.length} 個售價會跟著改）` : ""}</button>
            </form>
          ) : (
            <p className="text-sm text-slate-600">價格都跟目前一樣，不用更新。</p>
          )}
          {missing.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <b>{missing.length}</b> 個設定為「跟著健保價」的品項在檔案裡找不到：
              {missing.map((n) => `${n.name}${n.nhiCode ? `（${n.nhiCode}）` : "（沒填健保碼）"}`).join("、")}。
              請確認健保碼，或改成手動輸入。
            </div>
          )}
        </section>
      )}
    </div>
  );
}
