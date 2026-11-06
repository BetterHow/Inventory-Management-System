"use client";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition } from "react";
import { NAV_START_EVENT } from "./NavProgress";

/**
 * A filter form that applies itself: picking from a dropdown or date updates the list right away,
 * and typing in a search box updates it after a short pause. No "查詢" button needed.
 * Empty fields are left out of the address so links stay short.
 */
export function AutoForm({ className, children, clearHref }: { className?: string; children: React.ReactNode; clearHref?: string }) {
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
        const typing = t.tagName === "INPUT" && ["text", "search", "number"].includes(t.type);
        if (timer.current) clearTimeout(timer.current);
        if (typing) timer.current = setTimeout(apply, 500);
        else apply();
      }}
    >
      {children}
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
      <button type="submit" className="sr-only" tabIndex={-1}>查詢</button>
    </form>
  );
}
