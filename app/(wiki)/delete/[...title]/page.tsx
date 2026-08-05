import { parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle } from "@/lib/wiki/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deleteDocument } from "@/lib/wiki/actions";

export default async function DeletePage({
  params,
}: {
  params: Promise<{ title: string[] }>;
}) {
  const { title } = await params;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!document || document.is_deleted) {
    return <p className="text-[var(--muted)]">삭제할 문서를 찾을 수 없습니다.</p>;
  }

  if (!user) {
    return <p className="text-[var(--muted)]">문서 삭제는 로그인한 사용자만 할 수 있습니다.</p>;
  }

  const action = deleteDocument.bind(null, title);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{parsed.fullTitle} 삭제</h1>
      <p className="mb-4 text-sm text-[var(--muted)]">
        문서를 삭제해도 기존 리비전은 역사에 그대로 남습니다. 삭제 후에도 되돌리기로 복구할 수
        있습니다.
      </p>
      <form action={action} className="flex max-w-md flex-col gap-3">
        <input
          type="text"
          name="comment"
          placeholder="삭제 사유(선택)"
          maxLength={200}
          className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-[var(--danger)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          삭제
        </button>
      </form>
    </div>
  );
}
