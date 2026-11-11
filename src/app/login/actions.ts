"use server";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE, SESSION_MAX_AGE, REMEMBER_MAX_AGE, signSession } from "@/lib/session";
import { UNIT_COOKIE } from "@/lib/prefs";
import { audit } from "@/lib/audit";

export async function login(_prev: string | null, fd: FormData): Promise<string | null> {
  const username = String(fd.get("username") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return "帳號或密碼錯誤";
  }
  const maxAge = fd.get("stay") ? REMEMBER_MAX_AGE : SESSION_MAX_AGE;
  const token = await signSession({ uid: user.id, role: user.role, name: user.name }, maxAge);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge,
    path: "/",
  });
  await audit("/login", "登入", null, user);
  store.delete(UNIT_COOKIE); // start from this person's own 負責庫別
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
