"use client";
import { useActionState, useState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  const [show, setShow] = useState(false);
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
          <div className="relative">
            <input name="password" type={show ? "text" : "password"} className="input pr-14" autoComplete="current-password" required />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute inset-y-0 right-0 px-3 text-xs text-slate-500 hover:text-slate-800"
              aria-label={show ? "隱藏密碼" : "顯示密碼"}
            >
              {show ? "隱藏" : "顯示"}
            </button>
          </div>
        </label>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn w-full" disabled={pending}>
          {pending ? "登入中⋯" : "登入"}
        </button>
      </form>
    </div>
  );
}
