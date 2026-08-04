import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-4 px-4 py-3">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-[var(--accent)] hover:text-[var(--accent-secondary)]"
        >
          Percentage
        </Link>
        <form action="/search" className="flex-1">
          <input
            type="search"
            name="q"
            placeholder="문서 검색"
            className="w-full max-w-sm rounded-md border border-[var(--border)] bg-transparent px-3 py-1.5 text-sm outline-none focus:border-[var(--accent)]"
          />
        </form>
        <Link
          href="/RecentChanges"
          className="text-sm text-[var(--muted)] hover:text-[var(--accent-secondary)]"
        >
          최근 변경
        </Link>
      </div>
    </header>
  );
}
