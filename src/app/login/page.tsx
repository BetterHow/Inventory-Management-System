"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import { login } from "./actions";
import { Eye, EyeOff, Package } from "lucide-react";

// Only the account name is remembered on this browser, never the password.
const REMEMBER_KEY = "ims_remember_username";

function readSaved() {
  try {
    return localStorage.getItem(REMEMBER_KEY) ?? "";
  } catch {
    return "";
  }
}

export default function LoginPage() {
  const [error, action, pending] = useActionState(login, null);
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(false);
  const userRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = readSaved();
    if (saved && userRef.current) {
      userRef.current.value = saved;
      setRemember(true);
      passRef.current?.focus();
    }
  }, []);

  function onSubmit() {
    try {
      const name = userRef.current?.value.trim() ?? "";
      if (remember && name) localStorage.setItem(REMEMBER_KEY, name);
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {}
  }

  return (
    <div className="flex min-h-screen items-center justify-center login-bg p-4">
      <form action={action} onSubmit={onSubmit} className="card w-full max-w-sm space-y-5 p-8 shadow-xl shadow-slate-900/5">
        <div className="flex flex-col items-center text-center">
          <span className="mb-3 grid size-12 place-items-center rounded-2xl bg-gradient-to-br from-teal-500 to-teal-600 text-white shadow-lg shadow-teal-900/20">
            <Package className="size-6" />
          </span>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">診所庫存管理系統</h1>
          <p className="mt-1 text-sm text-slate-500">請登入以繼續</p>
        </div>
        <label className="block">
          <span className="label">帳號</span>
          <input ref={userRef} name="username" className="input" autoComplete="username" required autoFocus />
        </label>
        <label className="block">
          <span className="label">密碼</span>
          <div className="relative">
            <input ref={passRef} name="password" type={show ? "text" : "password"} className="input pr-11" autoComplete="current-password" required />
            <button
              type="button"
              onClick={() => setShow(!show)}
              className="absolute inset-y-0 right-0 grid w-10 place-items-center rounded-r-lg text-slate-400 hover:text-slate-700"
              aria-label={show ? "隱藏密碼" : "顯示密碼"}
              title={show ? "隱藏密碼" : "顯示密碼"}
            >
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
        </label>
        <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="size-4 accent-teal-600" />
            記住帳號
          </label>
          <label className="flex cursor-pointer items-center gap-2" title="在這台電腦上 30 天內不用重新登入。公用電腦請不要勾選。">
            <input type="checkbox" name="stay" value="1" className="size-4 accent-teal-600" />
            保持登入 30 天
          </label>
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
        <button className="btn w-full py-2.5" disabled={pending}>
          {pending ? "登入中⋯" : "登入"}
        </button>
      </form>
    </div>
  );
}
