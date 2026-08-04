"use client";

import { ArrowUpIcon } from "@/components/ui/icons";

export function ScrollToTopButton() {
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="맨 위로"
      className="fixed right-6 bottom-6 z-10 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--accent-warm)]"
    >
      <ArrowUpIcon className="h-5 w-5" />
    </button>
  );
}
