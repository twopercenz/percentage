import { parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle } from "@/lib/wiki/queries";
import { getEditRequestsByDocument } from "@/lib/wiki/editRequests";
import { getUsernamesByIds } from "@/lib/wiki/profiles";
import { editorDisplayName } from "@/lib/wiki/editorDisplay";
import { createEditRequest } from "@/lib/wiki/editRequestActions";

const STATUS_LABEL: Record<string, string> = {
  pending: "대기중",
  approved: "승인됨",
  rejected: "거절됨",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "text-[var(--muted)]",
  approved: "text-[var(--success)]",
  rejected: "text-[var(--danger)]",
};

export default async function EditRequestPage({
  params,
}: {
  params: Promise<{ title: string[] }>;
}) {
  const { title } = await params;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);

  if (!document || document.is_deleted) {
    return <p className="text-[var(--muted)]">편집을 요청할 문서를 찾을 수 없습니다.</p>;
  }

  const requests = await getEditRequestsByDocument(document.id);
  const userIds = requests.map((r) => r.requester_user_id).filter((id): id is string => id != null);
  const usernameById = await getUsernamesByIds(userIds);

  const action = createEditRequest.bind(null, title);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">{parsed.fullTitle} 편집 요청</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        지금은 모든 문서를 누구나 편집할 수 있지만, 나중에 편집이 제한된 문서가 생기면 이곳에서
        편집을 요청할 수 있습니다.
      </p>

      <form action={action} className="mb-8 flex max-w-lg flex-col gap-3">
        <textarea
          name="message"
          placeholder="어떤 내용을 편집하고 싶은지 적어 주세요"
          rows={4}
          required
          className="w-full rounded-md border border-[var(--border)] bg-[var(--code-background)] p-3 text-sm outline-none focus:border-[var(--accent-secondary)]"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-secondary)]"
        >
          요청 보내기
        </button>
      </form>

      {requests.length === 0 ? (
        <p className="py-8 text-center text-sm text-[var(--muted)]">
          아직 이 문서에 대한 편집 요청이 없습니다.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
          {requests.map((request) => (
            <li key={request.id} className="py-3">
              <div className="mb-1 flex flex-wrap items-center gap-2 font-mono text-xs text-[var(--muted)]">
                <span className={`font-bold ${STATUS_CLASS[request.status] ?? "text-[var(--muted)]"}`}>
                  {STATUS_LABEL[request.status] ?? request.status}
                </span>
                <span>·</span>
                <span>
                  {editorDisplayName(
                    { editor_user_id: request.requester_user_id, editor_ip_display: request.requester_ip_display },
                    usernameById,
                  )}
                </span>
                <span>·</span>
                <time>{new Date(request.created_at).toLocaleString("ko-KR")}</time>
              </div>
              <p className="text-sm whitespace-pre-wrap">{request.message}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
