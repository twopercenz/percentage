import Link from "next/link";
import { fullTitleHref } from "@/lib/wiki/title";
import { searchDocuments } from "@/lib/wiki/queries";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = query ? await searchDocuments(query) : [];

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-[var(--accent)]">{query ? `"${query}" 검색 결과` : "문서 검색"}</h1>

      <form action="/search" className="mb-6 flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={query}
          placeholder="문서 제목 검색"
          className="w-full max-w-sm rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-secondary)]"
        >
          검색
        </button>
      </form>

      {query && results.length === 0 ? (
        <p className="text-[var(--muted)]">
          일치하는 문서가 없습니다.{" "}
          <Link
            href={fullTitleHref("/edit", query)}
            className="text-[var(--accent)] underline hover:text-[var(--accent-secondary)]"
          >
            &quot;{query}&quot; 문서 만들기
          </Link>
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {results.map((document) => (
            <li key={document.id} className="py-2 text-sm">
              <Link
                href={fullTitleHref("/w", document.full_title)}
                className="text-[var(--accent)] underline hover:text-[var(--accent-secondary)]"
              >
                {document.full_title}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
