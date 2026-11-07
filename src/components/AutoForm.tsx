"use client";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { NAV_START_EVENT } from "./NavProgress";

/**
 * A filter form: picking from a dropdown or ticking a box updates the list right away.
 * Typed text and dates wait for the 查詢 button (or Enter), so the list doesn't jump while typing.
 * Empty fields are left out of the address so links stay short.
 */
export function AutoForm({ className, children, clearHref, noButton }: {
  className?: string;
  children: React.ReactNode;
  clearHref?: string;
  noButton?: boolean; // only dropdowns, nothing to type
}) {
  const path = usePathname();
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [, startTransition] = useTransition();

  function apply() {
    if (timer.current) clearTimeout(timer.current);
    const form = ref.current;
    if (!form) return;
    const q = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v !== "") q.set(k, v);
    const s = q.toString();
    if (s === new URLSearchParams(location.search).toString()) return;
    window.dispatchEvent(new Event(NAV_START_EVENT));
    startTransition(() => router.replace(s ? `${path}?${s}` : path, { scroll: false }));
  }

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onChange={(e) => {
        const t = e.target as unknown as HTMLInputElement;
        if (t.tagName === "SELECT" || t.type === "checkbox" || t.type === "radio") apply();
      }}
    >
      {children}
      {noButton ? (
        <button type="submit" className="sr-only" tabIndex={-1}>查詢</button>
      ) : (
        <button type="submit" className="btn">查詢</button>
      )}
      {clearHref && (
        <button
          type="button"
          className="btn-secondary"
          onClick={() => {
            if (timer.current) clearTimeout(timer.current);
            // Empty the visible fields too; hidden ones (current tab, warehouse) are kept by clearHref.
            for (const el of Array.from(ref.current?.elements ?? []) as HTMLInputElement[]) {
              if (!el.name || el.type === "hidden") continue;
              if (el.type === "checkbox") el.checked = false;
              else el.value = "";
            }
            window.dispatchEvent(new Event(NAV_START_EVENT));
            startTransition(() => router.replace(clearHref, { scroll: false }));
          }}
        >
          清除條件
        </button>
      )}
    </form>
  );
}
