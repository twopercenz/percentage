import Link from "next/link";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle, getRevisionsByDocumentId } from "@/lib/wiki/queries";
import { getUsernamesByIds } from "@/lib/wiki/profiles";
import { editorDisplayName } from "@/lib/wiki/editorDisplay";
import { ByteDiffBadge } from "@/components/wiki/ByteDiffBadge";

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ title: string[] }>;
}) {
  const { title } = await params;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);

  if (!document) {
    return <p className="text-[var(--muted)]">{parsed.fullTitle} 문서의 역사가 없습니다.</p>;
  }

  const revisions = await getRevisionsByDocumentId(document.id);
  const userIds = revisions
    .map((revision) => revision.editor_user_id)
    .filter((id): id is string => id != null);
  const usernameById = await getUsernamesByIds(userIds);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-[var(--accent)]">{parsed.fullTitle} 역사</h1>
      <ul className="divide-y divide-[var(--border)]">
        {revisions.map((revision, index) => {
          const previous = revisions[index + 1];
          return (
            <li key={revision.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <span className="w-14 text-[var(--muted)]">r{revision.rev_number}</span>
              <time className="text-[var(--muted)]">
                {new Date(revision.created_at).toLocaleString("ko-KR")}
              </time>
              <span>{editorDisplayName(revision, usernameById)}</span>
              <ByteDiffBadge byteDiff={revision.byte_diff} />
              <span className="text-[var(--muted)]">{revision.comment}</span>
              {previous ? (
                <Link
                  href={`${fullTitleHref("/diff", parsed.fullTitle)}?from=${previous.rev_number}&to=${revision.rev_number}`}
                  className="ml-auto text-[var(--accent)] hover:text-[var(--accent-secondary)]"
                >
                  이전과 비교
                </Link>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
