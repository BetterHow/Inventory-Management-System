"use client";
import { useState } from "react";

const fmt = (n: number) => Math.round(n).toLocaleString("zh-TW");
const short = (n: number) => {
  const a = Math.abs(n);
  if (a >= 1e8) return `${(n / 1e8).toFixed(1).replace(/\.0$/, "")}億`;
  if (a >= 1e4) return `${(n / 1e4).toFixed(1).replace(/\.0$/, "")}萬`;
  return fmt(n);
};

/** Rounds the axis top up to a tidy number and returns 4 grid steps. */
function niceTicks(max: number, min = 0) {
  const span = Math.max(max - min, 1);
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v);
  return { lo, hi, ticks };
}

export type Series = { key: string; label: string; color: string; values: number[] };

/** Line chart, one money axis, hover shows every series for that month. */
export function LineChart({ labels, series, height = 260 }: { labels: string[]; series: Series[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 720, H = height, L = 56, R = 16, T = 16, B = 28;
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const { hi, ticks } = niceTicks(max);
  const x = (i: number) => L + (i * (W - L - R)) / Math.max(labels.length - 1, 1);
  const y = (v: number) => T + (1 - v / hi) * (H - T - B);
  const step = (W - L - R) / Math.max(labels.length - 1, 1);
  return (
    <div className="relative">
      <Legend series={series} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={series.map((s) => s.label).join("、") + "每月趨勢"} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="stroke-slate-200" strokeWidth={1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{short(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" className={`text-[11px] ${hover === i ? "fill-slate-700" : "fill-slate-400"}`}>{l}</text>
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="stroke-slate-300" strokeWidth={1} />}
        {series.map((s) => (
          <g key={s.key}>
            <polyline fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
              points={s.values.map((v, i) => `${x(i)},${y(v)}`).join(" ")} />
            {hover !== null && <circle cx={x(hover)} cy={y(s.values[hover])} r={4.5} fill={s.color} className="stroke-[var(--surface)]" strokeWidth={2} />}
          </g>
        ))}
        {labels.map((_, i) => (
          <rect key={i} x={x(i) - step / 2} y={T} width={step} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <Tooltip leftPct={(x(hover) / W) * 100} title={labels[hover]}
          rows={series.map((s) => ({ color: s.color, label: s.label, value: fmt(s.values[hover]) }))} />
      )}
    </div>
  );
}

/** Bars around zero: above = 賺, below = 賠. */
export function BarChart({ labels, values, label, pos, neg, height = 200, width = 720 }: {
  labels: string[]; values: number[]; label: string; pos: string; neg: string; height?: number; width?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = width, H = height, L = 56, R = 16, T = 12, B = 28;
  const { lo, hi, ticks } = niceTicks(Math.max(0, ...values), Math.min(0, ...values));
  const y = (v: number) => T + ((hi - v) / (hi - lo || 1)) * (H - T - B);
  const slot = (W - L - R) / labels.length;
  const bw = Math.min(28, slot * 0.6);
  const cx = (i: number) => L + slot * i + slot / 2;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={label + "每月"} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className={t === 0 ? "stroke-slate-300" : "stroke-slate-200"} strokeWidth={1} />
            <text x={L - 8} y={y(t) + 4} textAnchor="end" className="fill-slate-400 text-[11px]">{short(t)}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const top = y(Math.max(v, 0)), bottom = y(Math.min(v, 0));
          const h = Math.max(bottom - top, v === 0 ? 0 : 1);
          const r = Math.min(4, h / 2, bw / 2);
          // round only the end away from zero
          const x0 = cx(i) - bw / 2;
          const d = v >= 0
            ? `M${x0},${bottom} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + bw - r} Q${x0 + bw},${top} ${x0 + bw},${top + r} V${bottom} Z`
            : `M${x0},${top} V${bottom - r} Q${x0},${bottom} ${x0 + r},${bottom} H${x0 + bw - r} Q${x0 + bw},${bottom} ${x0 + bw},${bottom - r} V${top} Z`;
          return <path key={i} d={d} fill={v >= 0 ? pos : neg} opacity={hover === null || hover === i ? 1 : 0.45} />;
        })}
        {labels.map((l, i) => (
          <text key={i} x={cx(i)} y={H - 8} textAnchor="middle" className={`text-[11px] ${hover === i ? "fill-slate-700" : "fill-slate-400"}`}>{l}</text>
        ))}
        {labels.map((_, i) => (
          <rect key={i} x={L + slot * i} y={T} width={slot} height={H - T - B} fill="transparent" onMouseEnter={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
      </svg>
      {hover !== null && (
        <Tooltip leftPct={(cx(hover) / W) * 100} title={labels[hover]}
          rows={[{ color: values[hover] >= 0 ? pos : neg, label, value: fmt(values[hover]) }]} />
      )}
    </div>
  );
}

function Legend({ series }: { series: Series[] }) {
  return (
    <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
      {series.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

function Tooltip({ leftPct, title, rows }: { leftPct: number; title: string; rows: { color: string; label: string; value: string }[] }) {
  return (
    <div
      className="pointer-events-none absolute top-6 z-10 min-w-36 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left: `${leftPct}%`, transform: leftPct > 60 ? "translateX(calc(-100% - 12px))" : "translateX(12px)" }}
    >
      <div className="mb-1 font-semibold text-slate-800">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 whitespace-nowrap text-slate-500"><span className="size-2 shrink-0 rounded-full" style={{ background: r.color }} />{r.label}</span>
          <span className="font-medium tabular-nums text-slate-800">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Horizontal bars for a ranking (one hue = magnitude). Values sit beside the bar in normal text. */
export function RankBars({ rows, color }: { rows: { label: string; value: number; sub?: string; href?: string }[]; color: string }) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="space-y-2.5">
      {rows.map((r) => (
        <li key={r.label} title={`${r.label}：${fmt(r.value)}`}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            {r.href ? <a href={r.href} className="truncate text-slate-700 hover:text-teal-700">{r.label}</a> : <span className="truncate text-slate-700">{r.label}</span>}
            <span className="shrink-0 tabular-nums text-slate-800">{fmt(r.value)}{r.sub && <span className="ml-1.5 text-xs text-slate-400">{r.sub}</span>}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${Math.max(2, (Math.abs(r.value) / max) * 100)}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
