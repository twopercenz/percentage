import Link from "next/link";
import { ClockIcon, LogoMark, SearchIcon } from "@/components/ui/icons";
import { SearchShortcut, SEARCH_INPUT_ID } from "@/components/layout/SearchShortcut";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-6xl items-center gap-6 px-4 py-3">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight text-[var(--foreground)] hover:text-[var(--accent)]"
        >
          <LogoMark className="h-6 w-6 text-[var(--accent)]" />
          Percentage
        </Link>

        <Link
          href="/RecentChanges"
          className="flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--accent)]"
        >
          <ClockIcon className="h-4 w-4" />
          최근 변경
        </Link>

        <form action="/search" className="ml-auto w-full max-w-sm">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              id={SEARCH_INPUT_ID}
              type="search"
              name="q"
              placeholder="문서 검색"
              className="w-full rounded-full border border-[var(--border)] bg-[var(--surface)] py-1.5 pr-9 pl-9 text-sm outline-none focus:border-[var(--accent)]"
            />
            <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-[var(--border)] px-1.5 font-mono text-xs text-[var(--muted)]">
              /
            </kbd>
          </div>
        </form>
      </div>
      <SearchShortcut />
    </header>
  );
}
