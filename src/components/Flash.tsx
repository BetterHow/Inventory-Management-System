import { Notice } from "./ui";

/** Shows ?error= and ?ok= messages that server actions pass back after a redirect. */
export function Flash({ sp }: { sp: Record<string, string | string[] | undefined> }) {
  const error = typeof sp.error === "string" ? sp.error : null;
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const warn = typeof sp.warn === "string" ? sp.warn : null;
  return (
    <>
      {error && <Notice kind="warn">{error}</Notice>}
      {warn && <Notice kind="warn">{warn}</Notice>}
      {ok && <Notice kind="ok">{ok}</Notice>}
    </>
  );
}
