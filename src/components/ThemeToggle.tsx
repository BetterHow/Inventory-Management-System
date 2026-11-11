"use client";
import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_COOKIE } from "@/lib/prefs";

type Mode = "system" | "light" | "dark";
const NEXT: Record<Mode, Mode> = { system: "light", light: "dark", dark: "system" };
const LABEL: Record<Mode, string> = { system: "跟隨系統", light: "淺色", dark: "深色" };

function apply(mode: Mode) {
  const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
}

/** Cycles 跟隨系統 → 淺色 → 深色. Remembered on this browser. */
export function ThemeToggle({ compact }: { compact?: boolean }) {
  const [mode, setMode] = useState<Mode>("system");
  useEffect(() => {
    const m = document.cookie.match(new RegExp(`(?:^|; )${THEME_COOKIE}=(light|dark)`));
    setMode((m?.[1] as Mode) ?? "system");
  }, []);
  useEffect(() => {
    if (mode !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mode]);
  function cycle() {
    const next = NEXT[mode];
    setMode(next);
    document.cookie =
      next === "system" ? `${THEME_COOKIE}=; path=/; max-age=0` : `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    apply(next);
  }
  const Icon = mode === "dark" ? Moon : mode === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={cycle}
      title={`外觀：${LABEL[mode]}（點一下切換）`}
      aria-label={`外觀：${LABEL[mode]}，點一下切換`}
      className="flex items-center gap-1.5 rounded-md p-1.5 text-xs text-slate-500 hover:bg-slate-100 hover:text-slate-800"
    >
      <Icon className="size-4" />
      {!compact && <span>{LABEL[mode]}</span>}
    </button>
  );
}
