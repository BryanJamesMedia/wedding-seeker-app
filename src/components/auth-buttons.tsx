"use client";

import { useRouter } from "next/navigation";
import { signOut } from "@/lib/auth-client";
import { openAuthModal } from "./gate-modal";

export function AuthButtons({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  if (signedIn) {
    return (
      <button
        type="button"
        onClick={async () => {
          await signOut();
          router.refresh();
        }}
        className="rounded-full px-3 py-2 text-muted hover:text-foreground"
      >
        Sign out
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openAuthModal({ reason: "signup" })}
      className="rounded-full bg-accent px-4 py-2 font-medium text-white hover:bg-accent-strong"
    >
      Sign up
    </button>
  );
}
