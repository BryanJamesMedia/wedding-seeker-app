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
        className="rounded-full px-3 py-2 font-medium text-foreground hover:text-accent"
      >
        Sign out
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={() => openAuthModal({ reason: "signup" })}
      className="rounded-lg btn-coral px-4 py-2"
    >
      Sign up
    </button>
  );
}
