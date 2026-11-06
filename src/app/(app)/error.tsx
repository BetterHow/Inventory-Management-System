"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card max-w-lg">
      <h2 className="mb-2 font-semibold text-rose-700">發生錯誤</h2>
      <p className="mb-4 text-sm text-slate-600">{error.message || "請稍後再試，或聯絡管理員。"}</p>
      <button className="btn-secondary" onClick={reset}>
        重試
      </button>
    </div>
  );
}
