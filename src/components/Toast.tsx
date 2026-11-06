"use client";
import { useEffect, useState } from "react";

/**
 * A small "saved" message that floats at the top and fades out, so the page doesn't jump.
 * Also removes ?ok= from the address so refreshing doesn't show it again.
 */
export function Toast({ message }: { message: string }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    setShown(true);
    const url = new URL(location.href);
    if (url.searchParams.has("ok")) {
      url.searchParams.delete("ok");
      history.replaceState(history.state, "", url.pathname + url.search);
    }
    const t = setTimeout(() => setShown(false), 2500);
    return () => clearTimeout(t);
  }, [message]);
  return (
    <div
      role="status"
      className={`pointer-events-none fixed left-1/2 top-4 z-40 -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800 shadow-md transition-opacity duration-500 ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      ✓ {message}
    </div>
  );
}
