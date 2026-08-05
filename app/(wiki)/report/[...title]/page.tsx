import { parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle } from "@/lib/wiki/queries";
import { createReport } from "@/lib/wiki/reportActions";

export default async function ReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ title: string[] }>;
  searchParams: Promise<{ comment?: string; done?: string }>;
}) {
  const { title } = await params;
  const { comment, done } = await searchParams;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);

  if (!document) {
    return <p className="text-[var(--muted)]">신고할 문서를 찾을 수 없습니다.</p>;
  }

  if (done) {
    return (
      <div>
        <h1 className="mb-2 text-xl font-bold">신고가 접수되었습니다</h1>
        <p className="text-sm text-[var(--muted)]">
          검토 후 필요한 조치가 이뤄집니다. 신고 내용과 처리 결과는 신고자만 볼 수 있습니다.
        </p>
      </div>
    );
  }

  const targetType = comment ? "discussion_comment" : "document";
  const targetId = comment ?? document.id;
  const action = createReport.bind(null, targetType, targetId, title);

  return (
    <div>
      <h1 className="mb-1 text-xl font-bold">
        {comment ? "댓글 신고" : `${parsed.fullTitle} 문서 신고`}
      </h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        신고 사유를 적어 주세요. 허위 신고는 다른 이용자에게 피해를 줄 수 있습니다.
      </p>

      <form action={action} className="flex max-w-lg flex-col gap-3">
        <textarea
          name="reason"
          placeholder="신고 사유"
          rows={5}
          required
          className="w-full rounded-md border border-[var(--border)] bg-[var(--code-background)] p-3 text-sm outline-none focus:border-[var(--accent-secondary)]"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          신고하기
        </button>
      </form>
    </div>
  );
}
