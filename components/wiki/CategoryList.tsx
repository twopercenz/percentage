import Link from "next/link";
import { fullTitleHref } from "@/lib/wiki/title";

export function CategoryList({
  categories,
  existingTitles,
}: {
  categories: string[];
  existingTitles: Set<string>;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--border)] px-3 py-2 text-sm">
      <span className="text-[var(--muted)]">분류:</span>
      {categories.map((category, index) => {
        const exists = existingTitles.has(category);
        const label = category.replace(/^분류:/, "");
        return (
          <span key={category} className="flex items-center gap-1.5">
            {index > 0 ? <span className="text-[var(--muted)]">|</span> : null}
            <Link
              href={fullTitleHref("/w", category)}
              className={
                exists
                  ? "text-[var(--accent-warm)] hover:text-[var(--accent-warm-secondary)]"
                  : "text-[var(--danger)]"
              }
            >
              {label}
            </Link>
          </span>
        );
      })}
    </div>
  );
}
