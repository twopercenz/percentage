import { parseFullTitle } from "@/lib/wiki/title";
import {
  getDocumentByFullTitle,
  getRevisionByNumber,
  getRevisionsByDocumentId,
} from "@/lib/wiki/queries";
import { diffLines } from "@/lib/diff";

export default async function DiffPage({
  params,
  searchParams,
}: {
  params: Promise<{ title: string[] }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { title } = await params;
  const { from, to } = await searchParams;
  const parsed = parseFullTitle(title);
  const document = await getDocumentByFullTitle(parsed.fullTitle);

  if (!document) {
    return <p className="text-[var(--muted)]">비교할 문서가 없습니다.</p>;
  }

  const revisions = await getRevisionsByDocumentId(document.id);
  const latest = revisions[0];
  const previous = revisions[1];

  const fromNumber = from ? Number(from) : previous?.rev_number;
  const toNumber = to ? Number(to) : latest?.rev_number;

  if (!fromNumber || !toNumber) {
    return <p className="text-[var(--muted)]">비교할 리비전이 부족합니다.</p>;
  }

  const [fromRevision, toRevision] = await Promise.all([
    getRevisionByNumber(document.id, fromNumber),
    getRevisionByNumber(document.id, toNumber),
  ]);

  if (!fromRevision || !toRevision) {
    return <p className="text-[var(--muted)]">해당 리비전을 찾을 수 없습니다.</p>;
  }

  const ops = diffLines(fromRevision.content, toRevision.content);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">
        {parsed.fullTitle} r{fromRevision.rev_number} → r{toRevision.rev_number}
      </h1>
      <pre className="overflow-x-auto rounded-md border border-[var(--border)] p-3 font-mono text-sm leading-6">
        {ops.map((op, index) => (
          <div
            key={index}
            className={
              op.type === "add"
                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : op.type === "remove"
                  ? "bg-red-500/10 text-red-700 dark:text-red-400"
                  : ""
            }
          >
            {op.type === "add" ? "+ " : op.type === "remove" ? "- " : "  "}
            {op.value}
          </div>
        ))}
      </pre>
    </div>
  );
}
