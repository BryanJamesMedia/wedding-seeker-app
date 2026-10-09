"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { openAuthModal, openUpgradeModal } from "./gate-modal";

/** Opens the sign-up or upgrade modal from ?signup=1 / ?upgrade=1 and strips the param. */
export function UrlTriggers({ signedIn }: { signedIn: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const signup = params.get("signup") === "1";
    const upgrade = params.get("upgrade") === "1";
    if (!signup && !upgrade) return;
    if (signup && !signedIn) openAuthModal({ reason: "signup" });
    else if (upgrade || signup) openUpgradeModal();
    const next = new URLSearchParams(params);
    next.delete("signup");
    next.delete("upgrade");
    next.delete("checkout");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router, signedIn]);
  return null;
}
