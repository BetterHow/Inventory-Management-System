import { cookies } from "next/headers";
import { Notice } from "./ui";
import { Toast } from "./Toast";
import { FLASH_COOKIE } from "@/lib/flash";

/**
 * Shows messages from server actions.
 * Problems (?error=, ?warn=) stay on the page; success (the flash cookie, or old-style ?ok=) is a toast that fades out.
 */
export async function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = typeof sp.error === "string" ? sp.error : null;
  const warn = typeof sp.warn === "string" ? sp.warn : null;
  const cookie = (await cookies()).get(FLASH_COOKIE)?.value;
  const ok = cookie ? decodeURIComponent(cookie) : typeof sp.ok === "string" ? sp.ok : null;
  return (
    <>
      {error && <Notice kind="warn">{error}</Notice>}
      {warn && <Notice kind="warn">{warn}</Notice>}
      {/* new key on every server render, so the same message twice still shows */}
      {ok && <Toast key={Date.now()} message={ok} />}
    </>
  );
}
