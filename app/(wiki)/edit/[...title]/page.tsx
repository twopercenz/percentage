import { parseFullTitle } from "@/lib/wiki/title";
import { getDocumentByFullTitle, getRevisionById } from "@/lib/wiki/queries";
import { saveRevision } from "@/lib/wiki/actions";

export default async function EditPage({
  params,
}: {
  params: Promise<{ title: string[] }>;
}) {
  const { title } = await params;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);
  const revision = document?.current_revision_id
    ? await getRevisionById(document.current_revision_id)
    : null;

  const action = saveRevision.bind(null, title);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-[var(--accent)]">{parsed.fullTitle} 편집</h1>
      <form action={action} className="flex flex-col gap-3">
        <textarea
          name="content"
          defaultValue={revision?.content ?? ""}
          rows={20}
          className="w-full rounded-md border border-[var(--border)] bg-[var(--code-background)] p-3 font-mono text-sm outline-none focus:border-[var(--accent-secondary)]"
        />
        <input
          type="text"
          name="comment"
          placeholder="편집 요약"
          maxLength={200}
          className="w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <button
          type="submit"
          className="self-start rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-secondary)]"
        >
          저장
        </button>
      </form>
    </div>
  );
}
