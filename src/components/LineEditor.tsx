"use client";
import { CameraScan } from "./CameraScan";
import { useEffect, useMemo, useRef, useState } from "react";

export type PickItem = {
  id: number;
  code: string;
  name: string;
  unit: string;
  barcode: string | null;
  nhiCode: string | null;
  keywords: string; // 搜尋關鍵字，空白分隔
  refPrice: number;
  trackBatch: boolean;
};

export type PickBatch = { id: number; itemId: number; warehouseId: number; lotNo: string; expiry: string; qty: number };

export type Line = {
  itemId: number;
  qty: number | "";
  freeQty?: number | "";
  unitPrice?: number | "";
  amount?: number | "";
  amountEdited?: boolean;
  lotNo?: string;
  expiryDate?: string;
  batchId?: number | "";
};

type Mode = "receipt" | "consume" | "transfer" | "purchase";

/**
 * Line items for receipts, consumption, transfers and the to-order list.
 * Type or scan a barcode / code / name in the top box and press Enter to add a row.
 * Rows are posted as JSON in the hidden "lines" field.
 */
export function LineEditor({
  mode,
  items,
  initial = [],
  batches = [],
  stock = {},
  warehouseId,
  itemsByWh,
}: {
  mode: Mode;
  itemsByWh?: Record<number, number[]>; // items each warehouse has had; the search lists those unless "全部品項" is ticked
  items: PickItem[];
  initial?: Line[];
  batches?: PickBatch[];
  stock?: Record<string, number>; // `${warehouseId}:${itemId}` -> qty
  warehouseId?: number;
}) {
  const [lines, setLines] = useState<Line[]>(initial);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const moved = useRef(false); // arrow keys used, so Enter on an empty box picks the highlighted item
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  // Which warehouse the items are for: given directly, or read from the form's 庫別 dropdown.
  const rootRef = useRef<HTMLDivElement>(null);
  const [formWh, setFormWh] = useState<number | undefined>();
  useEffect(() => {
    if (warehouseId !== undefined) return;
    const sel = rootRef.current?.closest("form")?.querySelector<HTMLSelectElement>("select[name=warehouseId]");
    if (!sel) return;
    const update = () => setFormWh(Number(sel.value) || undefined);
    update();
    sel.addEventListener("change", update);
    return () => sel.removeEventListener("change", update);
  }, [warehouseId]);
  const wh = warehouseId ?? formWh;
  const [allItems, setAllItems] = useState(false);
  const pool = useMemo(() => {
    const ids = itemsByWh && wh ? new Set(itemsByWh[wh] ?? []) : null;
    return ids && !allItems ? items.filter((i) => ids.has(i.id)) : items;
  }, [items, allItems, wh, itemsByWh]);
  const filtered = Boolean(itemsByWh && wh);
  const hiddenCount = items.length - pool.length;

  // Typed text: search. Empty box: this unit's items in code order.
  const matches = useMemo(
    () => (query.trim() ? searchItems(pool, query) : [...pool].sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true })).slice(0, 100)),
    [pool, query],
  );

  function exact(q: string): PickItem | undefined {
    const s = q.trim().toLowerCase();
    if (!s) return;
    return items.find((i) => i.barcode?.toLowerCase() === s || i.code.toLowerCase() === s || i.nhiCode?.toLowerCase() === s || label(i).toLowerCase() === s);
  }

  function find(q: string): PickItem | undefined {
    const hit = exact(q);
    if (hit || !q.trim()) return hit;
    const partial = searchItems(items, q);
    return partial.length === 1 ? partial[0] : undefined;
  }

  function add(picked?: PickItem) {
    const it = picked ?? find(query);
    if (!it) {
      setMsg(query.trim() ? `找不到「${query}」，或符合的品項不只一個，請從清單選擇` : "");
      return;
    }
    setMsg("");
    setQuery("");
    setOpen(false);
    // Scanning the same item again in consumption adds one more instead of a new row.
    const idx = lines.findIndex((l) => l.itemId === it.id);
    if (idx >= 0 && (mode === "consume" || mode === "transfer")) {
      update(idx, { qty: (Number(lines[idx].qty) || 0) + 1 });
      return;
    }
    const line: Line = { itemId: it.id, qty: mode === "consume" || mode === "transfer" ? 1 : "" };
    if (mode === "receipt") Object.assign(line, { freeQty: "", unitPrice: it.refPrice || "", amount: "", lotNo: "", expiryDate: "" });
    if (mode === "consume" || mode === "transfer") line.batchId = "";
    setLines([...lines, line]);
    setTimeout(() => qtyRefs.current[lines.length]?.focus(), 0);
  }

  function update(i: number, patch: Partial<Line>) {
    setLines((prev) =>
      prev.map((l, j) => {
        if (j !== i) return l;
        const n = { ...l, ...patch };
        if (mode === "receipt" && !n.amountEdited && ("qty" in patch || "unitPrice" in patch)) {
          const q = Number(n.qty) || 0;
          const p = Number(n.unitPrice) || 0;
          n.amount = q && p ? Math.round(q * p * 100) / 100 : "";
        }
        return n;
      }),
    );
  }

  const total = lines.reduce((s, l) => s + (Number(l.amount) || 0), 0);

  return (
    <div ref={rootRef}>
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-md">
          <input
            value={query}
            autoComplete="off"
            onChange={(e) => {
              setQuery(e.target.value);
              moved.current = false;
              setOpen(true);
              setHi(0);
              setMsg("");
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onKeyDown={(e) => {
              const showing = open && matches.length > 0;
              if ((e.key === "ArrowDown" || e.key === "ArrowUp") && showing) moved.current = true;
              if (e.key === "ArrowDown" && showing) {
                e.preventDefault();
                setHi((hi + 1) % matches.length);
              } else if (e.key === "ArrowUp" && showing) {
                e.preventDefault();
                setHi((hi - 1 + matches.length) % matches.length);
              } else if (e.key === "Escape") {
                setOpen(false);
              } else if (e.key === "Enter") {
                e.preventDefault();
                // A scanned barcode or exact code wins; otherwise take the highlighted suggestion.
                add(find(query) ?? (showing && (query.trim() || moved.current) ? matches[hi] : undefined));
              }
            }}
            placeholder="掃條碼，或輸入料號／品名／健保碼／關鍵字"
            className="input"
          />
          {open && (query.trim() !== "" || matches.length > 0) && (
            <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
              {matches.length === 0 && <li className="px-3 py-2 text-slate-400">沒有符合的品項</li>}
              {matches.map((it, i) => (
                <li
                  key={it.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(it);
                  }}
                  onMouseEnter={() => setHi(i)}
                  className={`flex cursor-pointer items-baseline justify-between gap-3 px-3 py-1.5 ${i === hi ? "bg-teal-50" : ""}`}
                >
                  <span>
                    <span className="font-medium">{it.name}</span>
                    <span className="ml-2 text-xs text-slate-400">{it.code}{it.nhiCode ? ` · ${it.nhiCode}` : ""}</span>
                  </span>
                  {warehouseId !== undefined && (mode === "consume" || mode === "transfer") && (
                    <span className="shrink-0 text-xs text-slate-500">庫存 {stock[`${warehouseId}:${it.id}`] ?? 0} {it.unit}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className="btn-secondary" onClick={() => add(find(query) ?? (query.trim() || moved.current ? matches[hi] : undefined))}>加入</button>
        <CameraScan
          onCode={(code) => {
            const it = exact(code);
            if (!it) return { ok: false, text: `找不到條碼 ${code} 的品項。請先到「品項」把條碼填上。` };
            add(it);
            return { ok: true, text: `已加入 ${it.name}` };
          }}
        />
        {filtered && (hiddenCount > 0 || allItems) && (
          <label className="flex items-center gap-1 text-sm text-slate-600" title="預設只列這個單位用過的品項">
            <input type="checkbox" checked={allItems} onChange={(e) => setAllItems(e.target.checked)} /> 全部品項{!allItems && `（另有 ${hiddenCount} 項）`}
          </label>
        )}
        {msg && <span className="text-sm text-rose-600">{msg}</span>}
      </div>

      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>品項</th>
              <th className="num">數量</th>
              {mode === "receipt" && (
                <>
                  <th className="num">贈品</th>
                  <th className="num">單價</th>
                  <th className="num">金額</th>
                  <th>批號</th>
                  <th>效期</th>
                </>
              )}
              {(mode === "consume" || mode === "transfer") && (
                <>
                  <th>批號</th>
                  <th className="num">目前庫存</th>
                </>
              )}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr><td colSpan={9} className="py-6 text-center text-slate-400">尚未加入品項</td></tr>
            )}
            {lines.map((l, i) => {
              const it = byId.get(l.itemId);
              const cur = warehouseId ? stock[`${warehouseId}:${l.itemId}`] ?? 0 : 0;
              const goesNegative = (mode === "consume" || mode === "transfer") && warehouseId && Number(l.qty) > cur;
              const itemBatches = batches.filter((b) => b.itemId === l.itemId && b.warehouseId === warehouseId);
              return (
                <tr key={i}>
                  <td className="min-w-48">
                    <div className="font-medium">{it?.name}</div>
                    <div className="text-xs text-slate-400">{it?.code} · {it?.unit}</div>
                  </td>
                  <td className="w-24">
                    <input
                      ref={(el) => { qtyRefs.current[i] = el; }}
                      type="number" step="0.01" className="input num" value={l.qty}
                      onChange={(e) => update(i, { qty: e.target.value === "" ? "" : Number(e.target.value) })}
                    />
                  </td>
                  {mode === "receipt" && (
                    <>
                      <td className="w-20">
                        <input type="number" step="0.01" className="input num" value={l.freeQty ?? ""}
                          onChange={(e) => update(i, { freeQty: e.target.value === "" ? "" : Number(e.target.value) })} />
                      </td>
                      <td className="w-28">
                        <input type="number" step="0.01" className="input num" value={l.unitPrice ?? ""}
                          onChange={(e) => update(i, { unitPrice: e.target.value === "" ? "" : Number(e.target.value) })} />
                      </td>
                      <td className="w-28">
                        <input type="number" step="0.01" className="input num" value={l.amount ?? ""} title="預設為數量×單價，可直接修改成發票上的金額"
                          onChange={(e) => update(i, { amount: e.target.value === "" ? "" : Number(e.target.value), amountEdited: e.target.value !== "" })} />
                      </td>
                      <td className="w-32">
                        <input className="input" value={l.lotNo ?? ""} disabled={it && !it.trackBatch}
                          onChange={(e) => update(i, { lotNo: e.target.value })} />
                      </td>
                      <td className="w-40">
                        <input type="date" className="input" value={l.expiryDate ?? ""} disabled={it && !it.trackBatch}
                          onChange={(e) => update(i, { expiryDate: e.target.value })} />
                      </td>
                    </>
                  )}
                  {(mode === "consume" || mode === "transfer") && (
                    <>
                      <td className="w-56">
                        <select className="input" value={l.batchId ?? ""} onChange={(e) => update(i, { batchId: e.target.value === "" ? "" : Number(e.target.value) })}>
                          <option value="">自動（先到期先用）</option>
                          {itemBatches.map((b) => (
                            <option key={b.id} value={b.id}>
                              {b.lotNo || "無批號"} {b.expiry && `· ${b.expiry}`} · 剩 {b.qty}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className={`num w-28 ${goesNegative ? "text-rose-600" : ""}`}>
                        {cur}
                        {goesNegative && <div className="text-xs">將變負庫存</div>}
                      </td>
                    </>
                  )}
                  <td className="w-10">
                    <button type="button" className="text-slate-400 hover:text-rose-600" title="移除"
                      onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {mode === "receipt" && lines.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={4} className="text-right font-medium">合計</td>
                <td className="num font-semibold">{total.toLocaleString("zh-TW", { maximumFractionDigits: 2 })}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

/**
 * Items that match what was typed, best first: exact code/barcode, then codes and names that start
 * with it, then anything containing it. Several words must all match (e.g. "口罩 L").
 */
export function searchItems(items: PickItem[], q: string, limit = 12): PickItem[] {
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const first = words[0];
  const scored: { it: PickItem; score: number }[] = [];
  for (const it of items) {
    const code = it.code.toLowerCase();
    const name = it.name.toLowerCase();
    const extra = [it.barcode, it.nhiCode, it.keywords].filter(Boolean).join(" ").toLowerCase();
    const keys = it.keywords ? it.keywords.toLowerCase().split(" ") : [];
    const hay = `${code} ${name} ${extra}`;
    if (!words.every((w) => hay.includes(w))) continue;
    let score = 5;
    if (code === first || it.barcode?.toLowerCase() === first || it.nhiCode?.toLowerCase() === first) score = 0;
    else if (keys.includes(first) || code.startsWith(first)) score = 1;
    else if (keys.some((k) => k.startsWith(first))) score = 2;
    else if (name.startsWith(first)) score = 2;
    else if (name.includes(first)) score = 3;
    else if (code.includes(first)) score = 4;
    scored.push({ it, score });
  }
  scored.sort((a, b) => a.score - b.score || a.it.code.localeCompare(b.it.code));
  return scored.slice(0, limit).map((s) => s.it);
}

function label(i: PickItem) {
  return `${i.code}｜${i.name}`;
}

/** Warehouse picker + line editor that knows which warehouse's stock and batches to show. */
export function WarehouseLines(props: {
  mode: Mode;
  items: PickItem[];
  batches: PickBatch[];
  stock: Record<string, number>;
  warehouses: { id: number; name: string }[];
  defaultWarehouseId?: number;
  warehouseLabel?: string;
  itemsByWh?: Record<number, number[]>;
}) {
  const [wid, setWid] = useState<number>(props.warehouses.find((w) => w.id === props.defaultWarehouseId)?.id ?? props.warehouses[0]?.id ?? 0);
  return (
    <div>
      <label className="mb-3 block max-w-xs">
        <span className="label">{props.warehouseLabel ?? "庫別"}</span>
        <select name="warehouseId" className="input" value={wid} onChange={(e) => setWid(Number(e.target.value))}>
          {props.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <LineEditor mode={props.mode} items={props.items} batches={props.batches} stock={props.stock} warehouseId={wid} itemsByWh={props.itemsByWh} />
    </div>
  );
}
