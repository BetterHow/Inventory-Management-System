import { Notice } from "./ui";
import { Toast } from "./Toast";

/**
 * Shows messages that server actions pass back after a redirect.
 * Problems (?error=, ?warn=) stay on the page; success (?ok=) is a toast that fades out.
 */
export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = typeof sp.error === "string" ? sp.error : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const warn = typeof sp.warn === "string" ? sp.warn : null;
  return (
    <>
      {error && <Notice kind="warn">{error}</Notice>}
      {warn && <Notice kind="warn">{warn}</Notice>}
      {/* new key on every server render, so the same message twice still shows */}
      {ok && <Toast key={Date.now()} message={ok} />}
    </>
  );
}
