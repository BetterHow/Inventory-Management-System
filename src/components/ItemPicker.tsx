"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { searchItems, type PickItem } from "./LineEditor";

const byCode = (a: PickItem, b: PickItem) => a.code.localeCompare(b.code, "en", { numeric: true });
const label = (i: PickItem) => `${i.code}｜${i.name}`;

/**
 * Pick one item for a form field (posted as "料號｜品名").
 * The list opens on click even after an item is chosen, showing the items around it in code order,
 * so a neighbouring item is one click away. Typing something else searches code, name, 健保碼 and barcode.
 */
export function ItemPicker({ name, items, required, itemsByWh }: {
  name: string;
  items: PickItem[];
  required?: boolean;
  itemsByWh?: Record<number, number[]>; // list only the items of the form's 庫別, unless "顯示全部品項" is clicked
}) {
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Empty the field when its form is reset (React resets a form after a successful save).
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const clear = () => setValue("");
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);
  const [formWh, setFormWh] = useState<number | undefined>();
  const [allItems, setAllItems] = useState(false);
  useEffect(() => {
    const sel = inputRef.current?.form?.querySelector<HTMLSelectElement>("select[name=warehouseId]");
    if (!sel) return;
    const update = () => setFormWh(Number(sel.value) || undefined);
    update();
    sel.addEventListener("change", update);
    return () => sel.removeEventListener("change", update);
  }, []);
  const pool = useMemo(() => {
    const ids = itemsByWh && formWh ? new Set(itemsByWh[formWh] ?? []) : null;
    return ids && !allItems ? items.filter((i) => ids.has(i.id)) : items;
  }, [items, itemsByWh, formWh, allItems]);
  const hiddenCount = items.length - pool.length;
  const sorted = useMemo(() => [...pool].sort(byCode), [pool]);

  const chosen = items.find((i) => label(i) === value || i.code.toLowerCase() === value.trim().toLowerCase() || (i.barcode && i.barcode === value.trim()));
  // Nothing typed or an item already chosen: the whole list in code order. Otherwise: search results.
  const shown = !value.trim() || (chosen && sorted.includes(chosen)) ? sorted : searchItems(chosen ? items : pool, value, 50);

  function openList() {
    setOpen(true);
    const idx = chosen ? shown.findIndex((i) => i.id === chosen.id) : 0;
    setHi(Math.max(0, idx));
  }

  // Keep the highlighted row in view (e.g. scroll to the chosen item when the list opens).
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[hi] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [open, hi]);

  function pick(i: PickItem) {
    setValue(label(i));
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        name={name}
        value={value}
        required={required}
        autoComplete="off"
        placeholder="掃條碼，或輸入料號／品名"
        className="input pr-9"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={openList}
        onClick={() => !open && openList()}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            if (!open) return openList();
            setHi(Math.min(hi + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi(Math.max(hi - 1, 0));
          } else if (e.key === "Escape") {
            setOpen(false);
          } else if (e.key === "Enter" && open && shown[hi] && shown[hi].id !== chosen?.id) {
            // Enter picks the highlighted item; once an item is chosen, Enter submits the form as usual.
            e.preventDefault();
            pick(shown[hi]);
          }
        }}
      />
      <button
        type="button"
        tabIndex={-1}
        aria-label="展開品項清單"
        onMouseDown={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
          if (open) setOpen(false);
          else openList();
        }}
        className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-xs text-slate-400 hover:text-slate-700"
      >
        ▼
      </button>
      {open && (
        <ul ref={listRef} className="absolute z-20 mt-1 max-h-72 w-full min-w-72 overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {shown.length === 0 && <li className="px-3 py-2 text-slate-400">沒有符合的品項</li>}
          {shown.map((it, i) => (
            <li
              key={it.id}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(it);
              }}
              onMouseEnter={() => setHi(i)}
              className={`flex cursor-pointer items-baseline gap-3 px-3 py-1.5 ${i === hi ? "bg-teal-50" : ""} ${it.id === chosen?.id ? "font-semibold text-teal-800" : ""}`}
            >
              <span className="w-20 shrink-0 text-xs text-slate-500">{it.code}</span>
              <span>{it.name}</span>
              <span className="ml-auto text-xs text-slate-400">{it.unit}</span>
            </li>
          ))}
          {hiddenCount > 0 && (
            <li
              onMouseDown={(e) => {
                e.preventDefault();
                setAllItems(true);
              }}
              className="cursor-pointer border-t border-slate-100 px-3 py-1.5 text-xs text-teal-700 hover:bg-slate-50"
            >
              顯示全部品項（另有 {hiddenCount} 項其他單位的品項）
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
