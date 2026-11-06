"use client";
import { useState } from "react";

/** A text box with a dropdown of common choices. Free typing still works. */
export function SuggestInput({
  name,
  options,
  defaultValue = "",
  placeholder,
}: {
  name: string;
  options: string[];
  defaultValue?: string;
  placeholder?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const s = value.trim().toLowerCase();
  const shown = s ? options.filter((o) => o.toLowerCase().includes(s) && o !== value) : options;

  function pick(o: string) {
    setValue(o);
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        name={name}
        value={value}
        autoComplete="off"
        placeholder={placeholder}
        className="input pr-8"
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
          setHi(0);
        }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!open || shown.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((hi + 1) % shown.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((hi - 1 + shown.length) % shown.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            pick(shown[hi] ?? shown[0]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-slate-400">▾</span>
      {open && shown.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {shown.map((o, i) => (
            <li
              key={o}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(o);
              }}
              onMouseEnter={() => setHi(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === hi ? "bg-teal-50 text-teal-800" : ""}`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
