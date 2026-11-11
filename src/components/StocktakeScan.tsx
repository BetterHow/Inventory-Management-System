"use client";
import { CameraScan } from "./CameraScan";

/** Stocktake: scan a box and jump to its row, ready to type the counted quantity. */
export function StocktakeScan() {
  return (
    <CameraScan
      once
      label="相機掃碼找品項"
      onCode={(code) => {
        const c = code.toLowerCase();
        const row = [...document.querySelectorAll<HTMLTableRowElement>("tr[data-codes]")].find((r) => r.dataset.codes!.split("|").includes(c));
        if (!row) return { ok: false, text: `這張盤點單沒有條碼 ${code} 的品項` };
        row.scrollIntoView({ block: "center" });
        row.classList.add("bg-teal-50");
        setTimeout(() => row.classList.remove("bg-teal-50"), 4000);
        setTimeout(() => row.querySelector("input")?.focus(), 100);
        return { ok: true, text: row.dataset.name ?? code };
      }}
    />
  );
}
