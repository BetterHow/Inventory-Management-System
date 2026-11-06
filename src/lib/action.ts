import "server-only";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { UserError, withParam } from "./form";

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
