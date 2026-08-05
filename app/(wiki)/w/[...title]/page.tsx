import Link from "next/link";
import { redirect } from "next/navigation";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import {
  getCategoryMembers,
  getDocumentByFullTitle,
  getDocumentCount,
  getExistingFullTitles,
  getRevisionById,
} from "@/lib/wiki/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  collectCategoryTargets,
  collectInternalLinkTargets,
  hasPagecountMacro,
  hasTocMacro,
  parse,
} from "@/lib/namumark/parser";
import { buildTableOfContents, renderDocument } from "@/lib/namumark/renderer";
import { resolveIncludes } from "@/lib/wiki/include";
import { CategoryList } from "@/components/wiki/CategoryList";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import { ActionButton } from "@/components/wiki/ActionButton";
import {
  BacklinkIcon,
  CompareIcon,
  DiscussIcon,
  EditIcon,
  HistoryIcon,
  MoveIcon,
  RequestIcon,
  TrashIcon,
} from "@/components/ui/icons";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ title: string[] }>;
}) {
  const { title } = await params;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);

  if (document?.redirect_target) {
    redirect(fullTitleHref("/w", document.redirect_target));
  }

  const revision = document?.current_revision_id
    ? await getRevisionById(document.current_revision_id)
    : null;

  const ast = revision ? parse(revision.content) : null;
  const linkTargets = ast ? collectInternalLinkTargets(ast) : [];
  const categories = ast ? collectCategoryTargets(ast) : [];
  const existingTitles = await getExistingFullTitles([...linkTargets, ...categories]);
  const toc = ast ? buildTableOfContents(ast) : [];
  // 본문에 [목차]를 이미 썼으면 그 자리에서 렌더되므로, 위쪽에 또 띄우지 않는다
  // (각주가 [각주]를 쓰면 자동 추가를 건너뛰는 것과 같은 패턴).
  const showTopToc = ast ? !hasTocMacro(ast) : false;
  // [pagecount]는 DB 조회가 필요해서, 문서에 실제로 쓰였을 때만 조회한다.
  const pageCount = ast && hasPagecountMacro(ast) ? await getDocumentCount() : undefined;
  // [include(...)]도 마찬가지로 실제로 쓰였을 때만(directives가 비어 있으면
  // resolveIncludes는 즉시 빈 Map을 돌려주고 추가 조회를 하지 않는다) 틀을 조회한다.
  const includedTemplates = ast ? await resolveIncludes(ast) : undefined;

  const categoryMembers =
    parsed.namespace === "분류" ? await getCategoryMembers(parsed.fullTitle) : [];

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
          <ActionButton
            href={fullTitleHref("/discuss", parsed.fullTitle)}
            icon={<DiscussIcon className="h-4 w-4" />}
            label="토론"
          />
          <ActionButton
            href={fullTitleHref("/edit-request", parsed.fullTitle)}
            icon={<RequestIcon className="h-4 w-4" />}
            label="편집 요청"
          />
          {user && document && !document.is_deleted ? (
            <>
              <ActionButton
                href={fullTitleHref("/move", parsed.fullTitle)}
                icon={<MoveIcon className="h-4 w-4" />}
                label="이동"
              />
              <ActionButton
                href={fullTitleHref("/delete", parsed.fullTitle)}
                icon={<TrashIcon className="h-4 w-4" />}
                label="삭제"
              />
            </>
          ) : null}
        </div>
      </div>

      {revision ? (
        <p className="mb-4 flex flex-wrap items-center gap-x-2 text-xs text-[var(--muted)]">
          <span>최근 수정 시각: {new Date(revision.created_at).toLocaleString("ko-KR")}</span>
          <span>·</span>
          <Link href={fullTitleHref("/report", parsed.fullTitle)} className="hover:text-[var(--danger)]">
            문서 신고
          </Link>
        </p>
      ) : null}

      {document?.is_deleted ? (
        <div className="py-16 text-center text-[var(--muted)]">
          <p>삭제된 문서입니다.</p>
          <Link
            href={fullTitleHref("/history", parsed.fullTitle)}
            className="mt-4 inline-block text-[var(--accent)] underline hover:text-[var(--accent-secondary)]"
          >
            역사에서 이전 리비전으로 되돌릴 수 있습니다
          </Link>
        </div>
      ) : ast ? (
        <>
          <CategoryList categories={categories} existingTitles={existingTitles} />
          {showTopToc ? <TableOfContents entries={toc} /> : null}
          <div className="namumark border-t border-[var(--border)] pt-4">
            {renderDocument(ast, { existingTitles, toc, pageCount, includedTemplates })}
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
