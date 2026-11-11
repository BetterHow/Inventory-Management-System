"use client";
import { useState } from "react";

/** 健保價／售價: follow the imported 健保價, or type a price by hand. */
export function PriceFields({ source, salePrice, nhiPrice, nhiPriceFrom, nhiCheckedAt }: {
  source: "NHI" | "MANUAL";
  salePrice: number | null;
  nhiPrice: number | null;
  nhiPriceFrom: string | null;
  nhiCheckedAt: string | null;
}) {
  const [mode, setMode] = useState(source);
  return (
    <div className="space-y-2 rounded-xl border border-slate-200 p-4 sm:col-span-2">
      <div className="text-sm font-medium text-slate-700">健保價／售價（每單位，用來算價差）</div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="priceSource" value="NHI" checked={mode === "NHI"} onChange={() => setMode("NHI")} className="accent-teal-600" />
          跟著健保價自動更新
        </label>
        <label className="flex cursor-pointer items-center gap-2">
          <input type="radio" name="priceSource" value="MANUAL" checked={mode === "MANUAL"} onChange={() => setMode("MANUAL")} className="accent-teal-600" />
          手動輸入
        </label>
      </div>
      {mode === "NHI" ? (
        <p className="text-sm text-slate-600">
          {nhiPrice != null ? (
            <>目前健保價 <b className="text-slate-900">{nhiPrice.toLocaleString("zh-TW")}</b>
              {nhiPriceFrom && <span className="text-slate-500">（{nhiPriceFrom} 起生效）</span>}
              {nhiCheckedAt && <span className="text-slate-400">・最近更新 {nhiCheckedAt}</span>}</>
          ) : (
            <span className="text-amber-700">還沒有健保價。請先填好上方的「健保碼」，再到「品項 → 健保價更新」匯入。</span>
          )}
        </p>
      ) : (
        <input name="salePrice" type="number" step="0.01" className="input max-w-xs" defaultValue={salePrice ?? ""} placeholder="可留空" />
      )}
    </div>
  );
}
