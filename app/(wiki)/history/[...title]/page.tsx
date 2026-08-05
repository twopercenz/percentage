import Link from "next/link";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle, getRevisionsByDocumentId } from "@/lib/wiki/queries";
import { getUsernamesByIds } from "@/lib/wiki/profiles";
import { editorDisplayName } from "@/lib/wiki/editorDisplay";
import { ByteDiffBadge } from "@/components/wiki/ByteDiffBadge";
import { revertRevision } from "@/lib/wiki/actions";

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
      <h1 className="mb-6 text-xl font-bold">{parsed.fullTitle} 역사</h1>
      <ol className="relative border-l border-[var(--border)] pl-6">
        {revisions.map((revision, index) => {
          const previous = revisions[index + 1];
          return (
            <li key={revision.id} className="relative pb-6 last:pb-0">
              <span className="absolute top-1.5 -left-[29px] h-2.5 w-2.5 rounded-full bg-[var(--accent)] ring-4 ring-[var(--background)]" />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-mono text-sm font-bold text-[var(--foreground)]">
                  r{revision.rev_number}
                </span>
                <span className="text-sm">{revision.comment}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 font-mono text-xs text-[var(--muted)]">
                <span>{editorDisplayName(revision, usernameById)}</span>
                <span>·</span>
                <time>{new Date(revision.created_at).toLocaleString("ko-KR")}</time>
                <span>·</span>
                <ByteDiffBadge byteDiff={revision.byte_diff} />
                {previous ? (
                  <>
                    <span>·</span>
                    <Link
                      href={`${fullTitleHref("/diff", parsed.fullTitle)}?from=${previous.rev_number}&to=${revision.rev_number}`}
                      className="text-[var(--accent)] hover:text-[var(--accent-secondary)]"
                    >
                      이전과 비교
                    </Link>
                  </>
                ) : null}
                {index > 0 ? (
                  <>
                    <span>·</span>
                    <form
                      action={revertRevision.bind(
                        null,
                        document.id,
                        revision.id,
                        revision.rev_number,
                        title,
                      )}
                    >
                      <button
                        type="submit"
                        className="text-[var(--accent)] hover:text-[var(--accent-secondary)]"
                      >
                        되돌리기
                      </button>
                    </form>
                  </>
                ) : null}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
