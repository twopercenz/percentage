import Link from "next/link";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle } from "@/lib/wiki/queries";
import { getCommentsByDiscussion, getDiscussionById, getDiscussionsByDocument } from "@/lib/wiki/discussions";
import { getUsernamesByIds } from "@/lib/wiki/profiles";
import { editorDisplayName } from "@/lib/wiki/editorDisplay";
import { addDiscussionComment, changeDiscussionStatus, createDiscussion } from "@/lib/wiki/discussionActions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { DiscussionStatusBadge } from "@/components/wiki/DiscussionStatusBadge";

// 문서 제목 자체에 "/"가 들어갈 수 있어([...title] catch-all인 이유) 스레드 id를
// 추가 경로 세그먼트로 두면 "이게 제목의 일부인지 스레드 id인지" 구분할 수 없다.
// 그래서 ?thread=<uuid> 쿼리로 목록/스레드 두 화면을 한 페이지에서 나눈다.
export default async function DiscussPage({
  params,
  searchParams,
}: {
  params: Promise<{ title: string[] }>;
  searchParams: Promise<{ thread?: string }>;
}) {
  const { title } = await params;
  const { thread } = await searchParams;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);

  if (!document || document.is_deleted) {
    return <p className="text-[var(--muted)]">토론할 문서를 찾을 수 없습니다.</p>;
  }

  if (thread) {
    return <DiscussionThread documentId={document.id} discussionId={thread} title={title} fullTitle={parsed.fullTitle} />;
  }

  const discussions = await getDiscussionsByDocument(document.id);
  const action = createDiscussion.bind(null, title);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">{parsed.fullTitle} 토론</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        이 문서에 대해 의견을 나눠보세요. 로그인 없이도 참여할 수 있습니다.
      </p>

      <form action={action} className="mb-8 flex max-w-lg flex-col gap-3">
        <input
          type="text"
          name="title"
          placeholder="새 토론 제목"
          maxLength={200}
          required
          className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <textarea
          name="content"
          placeholder="내용을 입력하세요"
          rows={4}
          required
          className="w-full rounded-md border border-[var(--border)] bg-[var(--code-background)] p-3 text-sm outline-none focus:border-[var(--accent-secondary)]"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-secondary)]"
        >
          토론 시작
        </button>
      </form>

      {discussions.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          아직 이 문서에는 아무 토론도 쌓이지 않았습니다.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {discussions.map((discussion) => (
            <li key={discussion.id} className="py-3">
              <Link
                href={`${fullTitleHref("/discuss", parsed.fullTitle)}?thread=${discussion.id}`}
                className="flex flex-wrap items-center gap-2 text-sm font-medium text-[var(--foreground)] hover:text-[var(--accent)]"
              >
                <DiscussionStatusBadge status={discussion.status} />
                {discussion.title}
              </Link>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {new Date(discussion.updated_at).toLocaleString("ko-KR")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const STATUS_ACTIONS: { status: "open" | "closed" | "paused"; label: string }[] = [
  { status: "open", label: "다시 열기" },
  { status: "paused", label: "보류" },
  { status: "closed", label: "닫기" },
];

async function DiscussionThread({
  documentId,
  discussionId,
  title,
  fullTitle,
}: {
  documentId: string;
  discussionId: string;
  title: string[];
  fullTitle: string;
}) {
  const discussion = await getDiscussionById(discussionId);

  if (!discussion || discussion.document_id !== documentId) {
    return <p className="text-[var(--muted)]">토론을 찾을 수 없습니다.</p>;
  }

  const comments = await getCommentsByDiscussion(discussionId);
  const userIds = comments.map((comment) => comment.author_user_id).filter((id): id is string => id != null);
  const usernameById = await getUsernamesByIds(userIds);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const replyAction = addDiscussionComment.bind(null, discussionId, title);
  const statusAction = changeDiscussionStatus.bind(null, discussionId, title);

  return (
    <div>
      <Link
        href={fullTitleHref("/discuss", fullTitle)}
        className="mb-4 inline-block text-sm text-[var(--accent)] hover:text-[var(--accent-secondary)]"
      >
        ← 토론 목록
      </Link>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <DiscussionStatusBadge status={discussion.status} />
        <h1 className="text-xl font-bold">{discussion.title}</h1>
      </div>

      <ul className="mb-6 flex flex-col gap-4">
        {comments.map((comment) =>
          comment.type === "status_change" ? (
            <li key={comment.id} className="text-xs text-[var(--muted)]">
              {editorDisplayName({ editor_user_id: comment.author_user_id, editor_ip_display: comment.author_ip_display }, usernameById)}
              님이 {comment.content}
              <span className="ml-2">{new Date(comment.created_at).toLocaleString("ko-KR")}</span>
            </li>
          ) : (
            <li key={comment.id} className="rounded-md border border-[var(--border)] p-3">
              <div className="mb-1 flex flex-wrap items-center gap-x-2 font-mono text-xs text-[var(--muted)]">
                <span>
                  {editorDisplayName(
                    { editor_user_id: comment.author_user_id, editor_ip_display: comment.author_ip_display },
                    usernameById,
                  )}
                </span>
                <span>·</span>
                <time>{new Date(comment.created_at).toLocaleString("ko-KR")}</time>
                <span>·</span>
                <Link href={`${fullTitleHref("/report", fullTitle)}?comment=${comment.id}`} className="hover:text-[var(--danger)]">
                  신고
                </Link>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </li>
          ),
        )}
      </ul>

      {discussion.status === "closed" ? (
        <p className="mb-4 text-sm text-[var(--muted)]">닫힌 토론에는 댓글을 남길 수 없습니다.</p>
      ) : (
        <form action={replyAction} className="mb-6 flex max-w-lg flex-col gap-3">
          <textarea
            name="content"
            placeholder="댓글을 입력하세요"
            rows={3}
            required
            className="w-full rounded-md border border-[var(--border)] bg-[var(--code-background)] p-3 text-sm outline-none focus:border-[var(--accent-secondary)]"
          />
          <button
            type="submit"
            className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-secondary)]"
          >
            댓글 남기기
          </button>
        </form>
      )}

      {user ? (
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-4">
          {STATUS_ACTIONS.filter((entry) => entry.status !== discussion.status).map((entry) => (
            <form key={entry.status} action={statusAction}>
              <input type="hidden" name="status" value={entry.status} />
              <button
                type="submit"
                className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {entry.label}
              </button>
            </form>
          ))}
        </div>
      ) : null}
    </div>
  );
}
