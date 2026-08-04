import Link from "next/link";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import {
  getCategoryMembers,
  getDocumentByFullTitle,
  getExistingFullTitles,
  getRevisionById,
} from "@/lib/wiki/queries";
import { collectCategoryTargets, collectInternalLinkTargets, parse } from "@/lib/namumark/parser";
import { renderDocument } from "@/lib/namumark/renderer";
import { CategoryList } from "@/components/wiki/CategoryList";

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

  const ast = revision ? parse(revision.content) : null;
  const linkTargets = ast ? collectInternalLinkTargets(ast) : [];
  const categories = ast ? collectCategoryTargets(ast) : [];
  const existingTitles = await getExistingFullTitles([...linkTargets, ...categories]);

  const categoryMembers =
    parsed.namespace === "분류" ? await getCategoryMembers(parsed.fullTitle) : [];

  return (
    <article>
      <div className="mb-4 flex items-center justify-between gap-4 border-b border-[var(--border)] pb-3">
        <h1 className="text-2xl font-bold text-[var(--accent)]">{parsed.fullTitle}</h1>
        <nav className="flex gap-3 text-sm text-[var(--muted)]">
          <Link href={fullTitleHref("/edit", parsed.fullTitle)} className="hover:text-[var(--accent-secondary)]">
            편집
          </Link>
          <Link href={fullTitleHref("/history", parsed.fullTitle)} className="hover:text-[var(--accent-secondary)]">
            역사
          </Link>
          <Link href={fullTitleHref("/diff", parsed.fullTitle)} className="hover:text-[var(--accent-secondary)]">
            비교
          </Link>
          <Link href={fullTitleHref("/backlink", parsed.fullTitle)} className="hover:text-[var(--accent-secondary)]">
            역링크
          </Link>
        </nav>
      </div>

      {ast ? (
        <>
          <div className="namumark">{renderDocument(ast, { existingTitles })}</div>
          <CategoryList categories={categories} existingTitles={existingTitles} />
        </>
      ) : (
        <div className="py-16 text-center text-[var(--muted)]">
          <p>아직 이 문서에는 아무것도 쌓이지 않았습니다.</p>
          <Link
            href={fullTitleHref("/edit", parsed.fullTitle)}
            className="mt-4 inline-block text-[var(--accent)] underline hover:text-[var(--accent-secondary)]"
          >
            문서 만들기
          </Link>
        </div>
      )}

      {parsed.namespace === "분류" && categoryMembers.length > 0 ? (
        <div className="mt-8 border-t border-[var(--border)] pt-4">
          <h2 className="mb-2 text-sm font-bold text-[var(--muted)]">이 분류에 속한 문서</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {categoryMembers.map((member) => (
              <li key={member.id}>
                <Link
                  href={fullTitleHref("/w", member.full_title)}
                  className="text-[var(--accent)] underline hover:text-[var(--accent-secondary)]"
                >
                  {member.full_title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
