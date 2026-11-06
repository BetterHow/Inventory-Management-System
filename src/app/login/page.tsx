"use client";
import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form action={action} className="card w-full max-w-sm space-y-4 p-6">
        <div>
          <h1 className="text-xl font-semibold">診所庫存管理系統</h1>
          <p className="text-sm text-slate-500">請登入</p>
        </div>
        <label className="block">
          <span className="label">帳號</span>
          <input name="username" className="input" autoComplete="username" required autoFocus />
        </label>
        <label className="block">
          <span className="label">密碼</span>
          <input name="password" type="password" className="input" autoComplete="current-password" required />
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn w-full" disabled={pending}>
          {pending ? "登入中⋯" : "登入"}
        </button>
      </form>
    </div>
  );
}
