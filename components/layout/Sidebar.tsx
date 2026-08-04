import Link from "next/link";
import { ClockIcon } from "@/components/ui/icons";
import { fullTitleHref } from "@/lib/wiki/title";
import { getRecentRevisions } from "@/lib/wiki/queries";

export async function Sidebar() {
  const revisions = await getRecentRevisions(8);

  return (
    <aside className="w-full shrink-0 lg:w-64">
      <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center gap-1.5 text-sm font-bold text-[var(--foreground)]">
          <ClockIcon className="h-4 w-4 text-[var(--accent-warm)]" />
          최근 변경
        </div>
        {revisions.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">아직 변경 내역이 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {revisions.map((revision) => (
              <li key={revision.id} className="flex items-center justify-between gap-2 text-sm">
                <Link
                  href={fullTitleHref("/w", revision.documentFullTitle)}
                  className="truncate text-[var(--accent-warm)] hover:text-[var(--accent-warm-secondary)]"
                >
                  {revision.documentFullTitle}
                </Link>
                <span className="shrink-0 text-xs text-[var(--muted)]">
                  {new Date(revision.created_at).toLocaleTimeString("ko-KR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}
