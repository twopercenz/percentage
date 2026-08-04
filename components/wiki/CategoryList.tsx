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
    <div className="mt-8 flex flex-wrap gap-2 border-t border-[var(--border)] pt-4 text-sm">
      {categories.map((category) => {
        const exists = existingTitles.has(category);
        return (
          <Link
            key={category}
            href={fullTitleHref("/w", category)}
            className={
              exists
                ? "rounded-full border border-[var(--border)] px-3 py-1 text-[var(--accent)] hover:text-[var(--accent-secondary)]"
                : "rounded-full border border-[var(--border)] px-3 py-1 text-[var(--danger)]"
            }
          >
            {category}
          </Link>
        );
      })}
    </div>
  );
}
