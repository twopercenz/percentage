import Link from "next/link";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { getBacklinks } from "@/lib/wiki/queries";

export default async function BacklinkPage({
  params,
}: {
  params: Promise<{ title: string[] }>;
}) {
  const { title } = await params;
  const parsed = parseFullTitle(title);
  const backlinks = await getBacklinks(parsed.fullTitle);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{parsed.fullTitle}의 역링크</h1>

      {backlinks.length === 0 ? (
        <p className="text-[var(--muted)]">이 문서를 링크하는 다른 문서가 없습니다.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {backlinks.map((document) => (
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
