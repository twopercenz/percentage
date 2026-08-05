import { collectIncludeDirectives, parse, type DocumentNode, type ResolvedIncludes } from "@/lib/namumark/parser";
import { getDocumentByFullTitle, getRevisionById } from "@/lib/wiki/queries";

// 틀 문서 최대 전개 깊이(틀이 틀을 include하는 경우). parser.ts의 MAX_NESTING_DEPTH와
// 같은 취지지만 별개 축이다 - 저건 한 번의 parse() 안에서 #!wiki/#!folding 등이
// 서로를 감싸는 깊이를, 이건 여러 번의 DB 조회를 거치는 틀 전개 체인 깊이를 막는다.
const MAX_INCLUDE_DEPTH = 5;

// 틀 본문의 "@key@"를 인자 값으로 치환한다. 인자로 안 넘어온 키는 오타를 알아채기
// 쉽도록 조용히 지우지 않고 "@key@" 그대로 남긴다.
function substituteParams(content: string, params: Record<string, string>): string {
  return content.replace(/@([^@\r\n]+)@/g, (match, rawKey: string) => {
    const key = rawKey.trim();
    return Object.prototype.hasOwnProperty.call(params, key) ? params[key] : match;
  });
}

// full_title 하나를 조회해서 현재 리비전 내용을 돌려준다. 문서가 없거나, 삭제됐거나,
// 리비전이 없거나, 조회 자체가 실패해도(RLS/네트워크 오류 등) null로 물러난다 -
// 틀 전개 실패가 문서 전체 렌더를 막아서는 안 된다.
async function fetchDocumentContent(fullTitle: string): Promise<string | null> {
  try {
    const document = await getDocumentByFullTitle(fullTitle);
    if (!document || document.is_deleted || !document.current_revision_id) return null;
    const revision = await getRevisionById(document.current_revision_id);
    return revision?.content ?? null;
  } catch {
    return null;
  }
}

// 문서 AST에 등장하는 [include(...)] 블록들을 재귀적으로 조회·치환·파싱해서 target별
// 결과를 평평한 Map으로 모은다. 렌더러(lib/namumark/renderer.tsx)는 이 Map만 보고
// 그리므로 DB를 몰라도 된다(§6 아키텍처: 외부 정보는 별도 단계에서 주입).
//
// ancestry는 지금까지 펼쳐 들어온 target 경로다 - 같은 target이 자기 자신의 전개
// 경로 안에 다시 나타나면(순환 include) 더 조회하지 않고 null로 남긴다(무한 재귀
// DB 조회 방지). depth는 그와 별개로 총 전개 깊이 자체를 제한한다.
export async function resolveIncludes(
  doc: DocumentNode,
  ancestry: string[] = [],
  depth = 0,
): Promise<ResolvedIncludes> {
  const resolved: ResolvedIncludes = new Map();
  if (depth >= MAX_INCLUDE_DEPTH) return resolved;

  const directives = collectIncludeDirectives(doc);

  for (const { target, params } of directives) {
    if (resolved.has(target)) continue; // 같은 문서에서 같은 틀을 여러 번 include해도 조회는 한 번만.

    if (ancestry.includes(target)) {
      resolved.set(target, null);
      continue;
    }

    const content = await fetchDocumentContent(target);
    if (content === null) {
      resolved.set(target, null);
      continue;
    }

    const nestedDoc = parse(substituteParams(content, params));
    resolved.set(target, nestedDoc);

    const nestedResolved = await resolveIncludes(nestedDoc, [...ancestry, target], depth + 1);
    for (const [nestedTarget, nestedValue] of nestedResolved) {
      if (!resolved.has(nestedTarget)) resolved.set(nestedTarget, nestedValue);
    }
  }

  return resolved;
}
