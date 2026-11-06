"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { UNIT_COOKIE } from "@/lib/prefs";

/** Switch 目前單位 (a warehouse id, or "all"). Remembered for a year on this browser. */
export async function setUnit(value: string) {
  await requireUser();
  const v = value === "all" || Number(value) > 0 ? value : "all";
  (await cookies()).set(UNIT_COOKIE, v, { path: "/", maxAge: 31536000, sameSite: "lax" });
  revalidatePath("/", "layout");
}
