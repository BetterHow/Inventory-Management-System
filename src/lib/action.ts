import "server-only";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { FLASH_COOKIE } from "./flash";
import { Prisma } from "@prisma/client";
import { UserError, withParam } from "./form";
import { audit } from "./audit";

/**
 * Run a server action body. Problems the user can fix (UserError, duplicate keys)
 * send them back to `backTo` with the message; everything else bubbles up.
 */
export async function attempt<T>(backTo: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UserError) redirect(withParam(backTo, "error", e.message));
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      redirect(withParam(backTo, "error", "資料重複：代碼或名稱已存在"));
    }
    throw e;
  }
}

/**
 * Finish a server action with a success message.
 * Staying on the same page: refresh it in place (no redirect, so the screen doesn't blank out).
 * Going to another page: redirect there. Every call is also written to 操作紀錄, with `detail` saying what was touched.
 * The message travels in a short-lived cookie and shows as a toast.
 */
export async function done(target: string, message: string, detail?: string | null, auditPath?: string): Promise<void> {
  await audit(auditPath ?? target, message, detail);
  (await cookies()).set(FLASH_COOKIE, encodeURIComponent(message), { path: "/", maxAge: 60, sameSite: "lax" });
  const referer = (await headers()).get("referer");
  const from = referer ? new URL(referer).pathname : null;
  const to = new URL(target, "http://local");
  if (from === to.pathname) {
    revalidatePath(to.pathname);
    return;
  }
  redirect(target);
}
