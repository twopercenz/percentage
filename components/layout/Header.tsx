import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]">
      <div className="mx-auto flex w-full max-w-5xl items-center px-4 py-3">
        <Link href="/" className="text-lg font-bold tracking-tight">
          Percentage
        </Link>
      </div>
    </header>
  );
}
