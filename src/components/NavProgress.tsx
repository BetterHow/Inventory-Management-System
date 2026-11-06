"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const NAV_START_EVENT = "ims:navstart";

/**
 * A thin bar at the top of the screen while the next page loads, so a click never feels ignored.
 * Starts on any in-app link click (or when a filter form fires NAV_START_EVENT) and stops when the address changes.
 * Used instead of a loading.tsx skeleton: with Next 15.5 that made links back to the same page
 * without filters (e.g. /stock?warehouse=2 → /stock) silently do nothing.
 */
export function NavProgress() {
  const path = usePathname();
  const search = useSearchParams().toString();
  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(false);
  }, [path, search]);

  useEffect(() => {
    document.body.toggleAttribute("data-navigating", active);
    if (!active) return;
    const t = setTimeout(() => setActive(false), 15000); // never stick forever
    return () => clearTimeout(t);
  }, [active]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname.startsWith("/api/")) return;
      if (url.pathname + url.search === location.pathname + location.search) return;
      setActive(true);
    }
    const onStart = () => setActive(true);
    document.addEventListener("click", onClick);
    window.addEventListener(NAV_START_EVENT, onStart);
    return () => {
      document.removeEventListener("click", onClick);
      window.removeEventListener(NAV_START_EVENT, onStart);
    };
  }, []);

  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-teal-100" role="progressbar" aria-label="載入中">
      <div className="nav-progress h-full w-1/3 bg-teal-600" />
    </div>
  );
}
