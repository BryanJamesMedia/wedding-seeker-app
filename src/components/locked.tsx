import { Lock } from "lucide-react";

/** Placeholder for a paid-only value. The real value is never sent to the client. */
export function LockedValue({ label = "Unlock with Plus", className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 text-muted ${className}`}>
      <Lock className="size-3.5" aria-hidden />
      <span className="locked-value select-none" aria-hidden>
        •••••••••
      </span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
