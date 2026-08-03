import Link from "next/link";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle, getRevisionsByDocumentId } from "@/lib/wiki/queries";
import { getUsernamesByIds } from "@/lib/wiki/profiles";
import { editorDisplayName } from "@/lib/wiki/editorDisplay";

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
      <h1 className="mb-4 text-xl font-bold">{parsed.fullTitle} 역사</h1>
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
              <span
                className={
                  revision.byte_diff > 0
                    ? "text-emerald-600"
                    : revision.byte_diff < 0
                      ? "text-red-600"
                      : "text-[var(--muted)]"
                }
              >
                {revision.byte_diff > 0 ? `+${revision.byte_diff}` : revision.byte_diff}
              </span>
              <span className="text-[var(--muted)]">{revision.comment}</span>
              {previous ? (
                <Link
                  href={`${fullTitleHref("/diff", parsed.fullTitle)}?from=${previous.rev_number}&to=${revision.rev_number}`}
                  className="ml-auto text-[var(--accent)]"
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
