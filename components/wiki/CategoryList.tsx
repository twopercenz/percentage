import Link from "next/link";
import { fullTitleHref } from "@/lib/wiki/title";

// GitHub 저장소 topic 태그처럼 작은 칩으로 보여준다.
export function CategoryList({
  categories,
  existingTitles,
}: {
  categories: string[];
  existingTitles: Set<string>;
}) {
  if (categories.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {categories.map((category) => {
        const exists = existingTitles.has(category);
        const label = category.replace(/^분류:/, "");
        return (
          <Link
            key={category}
            href={fullTitleHref("/w", category)}
            className={
              exists
                ? "rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 font-mono text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
                : "rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 font-mono text-xs text-[var(--danger)]"
            }
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
