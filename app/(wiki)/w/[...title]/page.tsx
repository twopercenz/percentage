import Link from "next/link";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import {
  getCategoryMembers,
  getDocumentByFullTitle,
  getExistingFullTitles,
  getRevisionById,
} from "@/lib/wiki/queries";
import { collectCategoryTargets, collectInternalLinkTargets, parse } from "@/lib/namumark/parser";
import { buildTableOfContents, renderDocument } from "@/lib/namumark/renderer";
import { CategoryList } from "@/components/wiki/CategoryList";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import { ActionButton } from "@/components/wiki/ActionButton";
import { BacklinkIcon, CompareIcon, EditIcon, HistoryIcon } from "@/components/ui/icons";

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
  const toc = ast ? buildTableOfContents(ast) : [];

  const categoryMembers =
    parsed.namespace === "분류" ? await getCategoryMembers(parsed.fullTitle) : [];

  return (
    <article>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">{parsed.fullTitle}</h1>
        <div className="flex flex-wrap gap-2">
          <ActionButton
            href={fullTitleHref("/edit", parsed.fullTitle)}
            icon={<EditIcon className="h-4 w-4" />}
            label="편집"
          />
          <ActionButton
            href={fullTitleHref("/history", parsed.fullTitle)}
            icon={<HistoryIcon className="h-4 w-4" />}
            label="역사"
          />
          <ActionButton
            href={fullTitleHref("/diff", parsed.fullTitle)}
            icon={<CompareIcon className="h-4 w-4" />}
            label="비교"
          />
          <ActionButton
            href={fullTitleHref("/backlink", parsed.fullTitle)}
            icon={<BacklinkIcon className="h-4 w-4" />}
            label="역링크"
          />
        </div>
      </div>

      {revision ? (
        <p className="mb-4 text-xs text-[var(--muted)]">
          최근 수정 시각: {new Date(revision.created_at).toLocaleString("ko-KR")}
        </p>
      ) : null}

      <CategoryList categories={categories} existingTitles={existingTitles} />

      {ast ? (
        <>
          <TableOfContents entries={toc} />
          <div className="namumark border-t border-[var(--border)] pt-4">
            {renderDocument(ast, { existingTitles })}
          </div>
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
