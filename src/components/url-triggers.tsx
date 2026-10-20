"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { openAuthModal, openWelcomeModal } from "./gate-modal";

/** Opens the sign-up modal (?signup=1) or the post-sign-in welcome (?welcome=1) and strips the params. */
export function UrlTriggers({ signedIn }: { signedIn: boolean }) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    const signup = params.get("signup") === "1";
    const upgrade = params.get("upgrade") === "1";
    const welcome = params.get("welcome") === "1";
    if (!signup && !upgrade && !welcome) return;
    if (signup && !signedIn) openAuthModal({ reason: "signup" });
    else if (welcome && signedIn) openWelcomeModal();
    const next = new URLSearchParams(params);
    next.delete("signup");
    next.delete("upgrade");
    next.delete("welcome");
    next.delete("checkout");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router, signedIn]);
  return null;
}
