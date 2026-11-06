"use client";
import { useActionState, useState } from "react";
import { login } from "./actions";
import { Package } from "lucide-react";

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  const [show, setShow] = useState(false);
  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(ellipse_at_top,_#ccfbf1_0%,_#f4f6f8_55%)] p-4">
      <form action={action} className="card w-full max-w-sm space-y-5 p-8 shadow-xl shadow-slate-900/5">
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-lg shadow-teal-900/20">
            <Package className="size-6" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">診所庫存管理系統</h1>
          <p className="mt-1 text-sm text-slate-500">請登入以繼續</p>
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
        <button className="btn w-full py-2.5" disabled={pending}>
          {pending ? "登入中⋯" : "登入"}
        </button>
      </form>
    </div>
  );
}
