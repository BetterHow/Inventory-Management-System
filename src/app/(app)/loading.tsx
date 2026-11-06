// Shown right away while the next page loads on the server, so a click never feels stuck.
export default function Loading() {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="載入中">
      <div className="mb-4 h-7 w-40 rounded bg-slate-200" />
      <div className="card space-y-3">
        <div className="h-4 w-3/4 rounded bg-slate-200" />
        <div className="h-4 w-1/2 rounded bg-slate-200" />
        <div className="h-4 w-2/3 rounded bg-slate-200" />
        <div className="h-4 w-1/3 rounded bg-slate-200" />
      </div>
      <div className="mt-3 text-sm text-slate-400">載入中⋯</div>
    </div>
  );
}
