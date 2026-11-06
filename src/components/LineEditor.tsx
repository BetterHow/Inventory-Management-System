"use client";
import { useMemo, useRef, useState } from "react";

export type PickItem = {
  id: number;
  code: string;
  name: string;
  unit: string;
  barcode: string | null;
  nhiCode: string | null;
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
}: {
  mode: Mode;
  items: PickItem[];
  initial?: Line[];
  batches?: PickBatch[];
  stock?: Record<string, number>; // `${warehouseId}:${itemId}` -> qty
  warehouseId?: number;
}) {
  const [lines, setLines] = useState<Line[]>(initial);
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState("");
  const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  function find(q: string): PickItem | undefined {
    const s = q.trim().toLowerCase();
    if (!s) return;
    const exact = items.find(
      (i) => i.barcode?.toLowerCase() === s || i.code.toLowerCase() === s || i.nhiCode?.toLowerCase() === s || label(i).toLowerCase() === s,
    );
    if (exact) return exact;
    const partial = items.filter((i) => i.name.toLowerCase().includes(s) || i.code.toLowerCase().includes(s));
    return partial.length === 1 ? partial[0] : undefined;
  }

  function add() {
    const it = find(query);
    if (!it) {
      setMsg(`找不到「${query}」，或符合的品項不只一個，請從清單選擇`);
      return;
    }
    setMsg("");
    setQuery("");
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
    <div>
      <input type="hidden" name="lines" value={JSON.stringify(lines)} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          list="item-options"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder="掃條碼，或輸入料號／品名後按 Enter"
          className="input max-w-md"
        />
        <button type="button" className="btn-secondary" onClick={add}>加入</button>
        <datalist id="item-options">
          {items.map((i) => <option key={i.id} value={label(i)} />)}
        </datalist>
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
}) {
  const [wid, setWid] = useState<number>(props.defaultWarehouseId ?? props.warehouses[0]?.id ?? 0);
  return (
    <div>
      <label className="mb-3 block max-w-xs">
        <span className="label">{props.warehouseLabel ?? "庫別"}</span>
        <select name="warehouseId" className="input" value={wid} onChange={(e) => setWid(Number(e.target.value))}>
          {props.warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
      </label>
      <LineEditor mode={props.mode} items={props.items} batches={props.batches} stock={props.stock} warehouseId={wid} />
    </div>
  );
}
