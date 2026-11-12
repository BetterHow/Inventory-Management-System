"use client";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";

const warmed = new Map<string, number>();

/**
 * next/link without loading every visible link in advance (a list of 50 rows meant 50 server calls on each page),
 * but loading a page as soon as the pointer or finger is on its link, so the click usually finds it ready.
 */
export default function Link({ prefetch, onMouseEnter, onTouchStart, ...props }: ComponentProps<typeof NextLink>) {
  const router = useRouter();
  const path = usePathname();
  function warm() {
    const href = typeof props.href === "string" ? props.href : null;
    if (!href || href.split("?")[0] === path || /^(https?:|mailto:|#)/.test(href) || href.startsWith("/api/")) return;
    const now = Date.now();
    if (now - (warmed.get(href) ?? 0) < 25000) return;
    warmed.set(href, now);
    router.prefetch(href, { kind: PrefetchKind.FULL });
  }
  return (
    <NextLink
      {...props}
      prefetch={prefetch ?? false}
      onMouseEnter={(e) => { warm(); onMouseEnter?.(e); }}
      onTouchStart={(e) => { warm(); onTouchStart?.(e); }}
    />
  );
}
