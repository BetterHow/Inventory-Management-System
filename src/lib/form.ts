// Helpers to read FormData in server actions.

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

export function optStr(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

export function numVal(fd: FormData, key: string, fallback = 0): number {
  const v = str(fd, key);
  if (v === "") return fallback;
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`「${key}」不是數字`);
  return n;
}

export function optNum(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  return v === "" ? null : numVal(fd, key);
}

export function intVal(fd: FormData, key: string): number {
  return Math.trunc(numVal(fd, key));
}

export function optInt(fd: FormData, key: string): number | null {
  const v = str(fd, key);
  return v === "" ? null : Math.trunc(Number(v));
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

export function json<T>(fd: FormData, key: string): T {
  return JSON.parse(String(fd.get(key) ?? "null")) as T;
}

/** Error a user can fix: the action redirects back with the message shown at the top of the page. */
export class UserError extends Error {}

export function withParam(path: string, key: string, value: string) {
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}${key}=${encodeURIComponent(value)}`;
}
