import { parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle } from "@/lib/wiki/queries";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { moveDocument } from "@/lib/wiki/actions";

export default async function MovePage({
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
    return <p className="text-[var(--muted)]">이동할 문서를 찾을 수 없습니다.</p>;
  }

  if (!user) {
    return <p className="text-[var(--muted)]">문서 이동은 로그인한 사용자만 할 수 있습니다.</p>;
  }

  const action = moveDocument.bind(null, title);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">{parsed.fullTitle} 이동</h1>
      <form action={action} className="flex max-w-md flex-col gap-3">
        <label className="text-sm text-[var(--muted)]">
          현재 이름
          <input
            type="text"
            value={parsed.fullTitle}
            disabled
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--muted)]"
          />
        </label>
        <label className="text-sm text-[var(--muted)]">
          새 이름
          <input
            type="text"
            name="to"
            required
            placeholder="예: 분류:새이름"
            className="mt-1 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
          />
        </label>
        <input
          type="text"
          name="comment"
          placeholder="이동 사유(선택)"
          maxLength={200}
          className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-secondary)]"
        >
          이동
        </button>
      </form>
      <p className="mt-3 text-xs text-[var(--muted)]">
        이동하면 옛 이름 자리에는 새 이름으로 안내하는 넘겨주기 문서가 남습니다.
      </p>
    </div>
  );
}
