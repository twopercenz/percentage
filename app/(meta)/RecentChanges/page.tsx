import Link from "next/link";
import { fullTitleHref } from "@/lib/wiki/title";
import { getRecentRevisions } from "@/lib/wiki/queries";
import { getUsernamesByIds } from "@/lib/wiki/profiles";
import { editorDisplayName } from "@/lib/wiki/editorDisplay";
import { revisionTypeLabel } from "@/lib/wiki/revisionType";
import { ByteDiffBadge } from "@/components/wiki/ByteDiffBadge";

export default async function RecentChangesPage() {
  const revisions = await getRecentRevisions(50);
  const userIds = revisions
    .map((revision) => revision.editor_user_id)
    .filter((id): id is string => id != null);
  const usernameById = await getUsernamesByIds(userIds);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">최근 변경</h1>

      {revisions.length === 0 ? (
        <p className="text-[var(--muted)]">아직 변경 내역이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {revisions.map((revision) => (
            <li key={revision.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
              <Link
                href={fullTitleHref("/w", revision.documentFullTitle)}
                className="font-medium text-[var(--accent)] underline hover:text-[var(--accent-secondary)]"
              >
                {revision.documentFullTitle}
              </Link>
              <span className="font-mono text-[var(--muted)]">r{revision.rev_number}</span>
              <span className="text-[var(--muted)]">{revisionTypeLabel(revision.type)}</span>
              <time className="text-[var(--muted)]">
                {new Date(revision.created_at).toLocaleString("ko-KR")}
              </time>
              <span>{editorDisplayName(revision, usernameById)}</span>
              <ByteDiffBadge byteDiff={revision.byte_diff} />
              <span className="text-[var(--muted)]">{revision.comment}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
