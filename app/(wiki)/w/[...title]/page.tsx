import Link from "next/link";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle, getRevisionById } from "@/lib/wiki/queries";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ title: string[] }>;
}) {
  const { title } = await params;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);
  const revision = document?.current_revision_id
    ? await getRevisionById(document.current_revision_id)
    : null;

  return (
    <article>
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
        <h1 className="text-2xl font-bold">{parsed.fullTitle}</h1>
        <nav className="flex gap-3 text-sm text-[var(--muted)]">
          <Link href={fullTitleHref("/edit", parsed.fullTitle)}>편집</Link>
          <Link href={fullTitleHref("/history", parsed.fullTitle)}>역사</Link>
          <Link href={fullTitleHref("/diff", parsed.fullTitle)}>비교</Link>
        </nav>
      </div>

      {revision ? (
        <pre className="whitespace-pre-wrap break-words font-sans text-base leading-7">
          {revision.content}
        </pre>
      ) : (
        <div className="py-16 text-center text-[var(--muted)]">
          <p>아직 이 문서에는 아무것도 쌓이지 않았습니다.</p>
          <Link
            href={fullTitleHref("/edit", parsed.fullTitle)}
            className="mt-4 inline-block text-[var(--accent)] underline"
          >
            문서 만들기
          </Link>
        </div>
      )}
    </article>
  );
}
