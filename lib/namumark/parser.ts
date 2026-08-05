import { tokenizeBlocks, type BlockToken, type ListStyle } from "./lexer";

export type { ListStyle } from "./lexer";

export type InlineType =
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "superscript"
  | "subscript";

export type LinkNode =
  | { type: "internal-link"; target: string; children: InlineNode[] | null }
  | { type: "anchor-link"; anchor: string; children: InlineNode[] | null }
  | { type: "external-link"; url: string; children: InlineNode[] | null }
  | { type: "file-link"; target: string; options: Record<string, string> }
  | { type: "category-link"; target: string };

// 각주 정의/참조에는 번호를 붙이지 않는다(AST에 굳이 담지 않는다) - 문서 전체를
// 훑어야 번호를 매길 수 있어서, 렌더러가 collectFootnotes()로 별도 계산한다.
export type FootnoteDefNode = { type: "footnote-def"; name: string | null; content: InlineNode[] };
export type FootnoteRefNode = { type: "footnote-ref"; name: string };
export type FootnoteListNode = { type: "footnote-list" };

// 매크로(9단계)는 전부 순수 AST 노드다: [date]/[age]/[dday]는 "지금" 시각에 의존하고
// [pagecount]는 DB 조회가 필요하지만, 그 계산 자체는 파서가 아니라 렌더러(및 그
// 위 페이지 컴포넌트)가 RenderContext를 통해 한다 - 파서는 문법만 인식한다.
export type MacroTocNode = { type: "macro-toc" };
export type MacroDateNode = { type: "macro-date" };
export type MacroAgeNode = { type: "macro-age"; date: string };
export type MacroDdayNode = { type: "macro-dday"; date: string };
export type MacroRubyNode = { type: "macro-ruby"; text: string; ruby: string };
export type MacroAnchorNode = { type: "macro-anchor"; name: string };
export type MacroPagecountNode = { type: "macro-pagecount" };
// [include(틀:이름, 인자=값)]가 문장 중간에 섞여 쓰이면(드문 경우) 이 인라인 노드로
// 남는다 - 틀 내용은 대개 블록(제목/표/문단...)이라 <p> 안에 통째로 끼워 넣으면 HTML
// 구조가 깨지므로, 실제 틀 전개는 온전한 한 줄짜리 [include(...)]만(IncludeBlockNode,
// 아래) 지원한다. 인라인 쪽은 조회 없이 그냥 무엇을 가리키는지만 보여준다.
export type MacroIncludeNode = { type: "macro-include"; target: string; params: Record<string, string> };

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "linebreak" }
  | { type: InlineType; children: InlineNode[] }
  | { type: "inline-code"; content: string }
  | { type: "inline-size"; delta: number; children: InlineNode[] }
  | { type: "inline-color"; color: string; children: InlineNode[] }
  | FootnoteDefNode
  | FootnoteRefNode
  | FootnoteListNode
  | MacroTocNode
  | MacroDateNode
  | MacroAgeNode
  | MacroDdayNode
  | MacroRubyNode
  | MacroAnchorNode
  | MacroPagecountNode
  | MacroIncludeNode
  | LinkNode;

export type HeadingNode = { type: "heading"; level: number; children: InlineNode[] };
export type ParagraphNode = { type: "paragraph"; children: InlineNode[] };
export type ListItemNode = { type: "list-item"; children: InlineNode[]; sublist: ListNode | null };
export type ListNode = { type: "list"; style: ListStyle; items: ListItemNode[] };
export type QuoteNode = { type: "quote"; children: InlineNode[]; nested: QuoteNode | null };
export type HrNode = { type: "hr" };
// "#redirect 문서명"이 문서 첫 줄에 있으면 넘겨주기다. 실제 이동(리다이렉트)은
// documents.redirect_target 컬럼을 보고 페이지 컴포넌트가 처리한다(§6) - 이 노드는
// 그 컬럼과 내용이 어긋났을 때(옛 리비전 보기 등)도 넘겨주기 대상을 화면에 보여주기 위함이다.
export type RedirectNode = { type: "redirect"; target: string };
// 자기 줄 전체가 정확히 "[include(틀:이름, 인자=값)]"인 경우에만 이 블록 노드가 된다
// (그래야 틀의 제목/표 같은 블록 내용을 문단 안이 아니라 문서에 바로 이어붙일 수 있다).
// 파서 자신은 틀 내용을 조회하지 않는다 - DB 조회·인자 치환·재귀 전개는 별도 단계
// (lib/wiki/include.ts)에서 하고, 그 결과를 렌더러가 RenderContext로 받는다.
export type IncludeBlockNode = {
  type: "include-block";
  target: string;
  params: Record<string, string>;
};

export type TableCellNode = {
  type: "table-cell";
  children: InlineNode[];
  colspan: number;
  rowspan: number;
  bgcolor: string | null;
  width: string | null;
};
export type TableRowNode = { type: "table-row"; cells: TableCellNode[] };
export type TableNode = {
  type: "table";
  align: string | null;
  width: string | null;
  bgcolor: string | null;
  rows: TableRowNode[];
};

export type CodeBlockNode = { type: "code-block"; language: string | null; content: string };
// #!html은 관리자 권한 문서에서만 진짜 HTML로 렌더할 예정이다(§6). ACL 세부 규칙(P4)이
// 아직 없어서, 지금은 렌더러가 이 노드를 항상 이스케이프된 텍스트로만 보여준다.
export type HtmlBlockNode = { type: "html-block"; content: string };
export type WikiBlockNode = {
  type: "wiki-block";
  style: Record<string, string> | null;
  children: BlockNode[];
};
export type FoldingBlockNode = { type: "folding-block"; title: InlineNode[]; children: BlockNode[] };
export type SizeBlockNode = { type: "size-block"; delta: number; children: BlockNode[] };
export type ColorBlockNode = { type: "color-block"; color: string; children: BlockNode[] };

export type BlockNode =
  | HeadingNode
  | ParagraphNode
  | ListNode
  | QuoteNode
  | HrNode
  | RedirectNode
  | IncludeBlockNode
  | TableNode
  | CodeBlockNode
  | HtmlBlockNode
  | WikiBlockNode
  | FoldingBlockNode
  | SizeBlockNode
  | ColorBlockNode;
export type DocumentNode = { type: "document"; children: BlockNode[] };

// target(틀 full_title) → 이미 파싱해둔 틀 내용(DocumentNode), 없거나 순환이면 null.
// lib/wiki/include.ts의 resolveIncludes()가 채우고, 렌더러는 RenderContext로 이것만
// 받아 쓴다(렌더러 자신은 DB를 모른다 - §6 아키텍처).
export type ResolvedIncludes = Map<string, DocumentNode | null>;

const INLINE_MARKERS: { token: string; type: InlineType }[] = [
  { token: "'''", type: "bold" },
  { token: "''", type: "italic" },
  { token: "__", type: "underline" },
  { token: "~~", type: "strikethrough" },
  { token: "--", type: "strikethrough" },
  { token: "^^", type: "superscript" },
  { token: ",,", type: "subscript" },
];

type Frame = { type: InlineType; token: string; children: InlineNode[] };

// target 부분(파이프 앞)의 형태로 링크 종류를 구분한다: #앵커, http(s):// 외부 링크,
// 파일: 파일 링크(뒤 파이프들은 표시 텍스트가 아니라 key=value 옵션), 분류: 분류 표시
// (본문 위치엔 아무것도 렌더되지 않고 문서 하단에 모아서 표시), 나머지는 내부 문서 링크.
function classifyLink(rawTarget: string, restParts: string[]): LinkNode {
  const target = rawTarget.trim();

  if (target.startsWith("#")) {
    const anchor = target.slice(1);
    const children = restParts.length ? parseInline(restParts.join("|")) : null;
    return { type: "anchor-link", anchor, children };
  }

  if (/^https?:\/\//.test(target)) {
    const children = restParts.length ? parseInline(restParts.join("|")) : null;
    return { type: "external-link", url: target, children };
  }

  if (target.startsWith("파일:")) {
    const options: Record<string, string> = {};
    for (const part of restParts) {
      const eqIndex = part.indexOf("=");
      if (eqIndex === -1) continue;
      options[part.slice(0, eqIndex).trim()] = part.slice(eqIndex + 1).trim();
    }
    return { type: "file-link", target, options };
  }

  if (target.startsWith("분류:")) {
    return { type: "category-link", target };
  }

  const children = restParts.length ? parseInline(restParts.join("|")) : null;
  return { type: "internal-link", target, children };
}

// 한 줄 안에서 열리고 닫히는 {{{...}}}를 해석한다(여러 줄짜리는 블록 단계에서
// 이미 처리되어 여기까지 오지 않는다). +N/-N은 글자 크기, #색상은 글자색이고
// 둘 다 안쪽을 다시 인라인 파싱한다. 아무 지시어도 없으면 그냥 인라인 코드다.
function classifyInlineBrace(inner: string): InlineNode {
  const sizeMatch = /^([+-])(\d)\s+([\s\S]*)$/.exec(inner);
  if (sizeMatch) {
    const sign = sizeMatch[1] === "-" ? -1 : 1;
    const delta = sign * Math.min(Number(sizeMatch[2]), 5);
    return { type: "inline-size", delta, children: parseInline(sizeMatch[3]) };
  }

  const colorMatch = /^#(?!!)(\S+)\s+([\s\S]*)$/.exec(inner);
  if (colorMatch) {
    return { type: "inline-color", color: colorMatch[1], children: parseInline(colorMatch[2]) };
  }

  return { type: "inline-code", content: inner };
}

// "*" 뒤 나머지 문자열로 각주 종류를 가른다:
// "* 내용"(뒤에 공백+내용) → 익명 정의, "*이름 내용" → 이름 있는 정의,
// "*이름"(공백 없이 이름만) → 이미 정의된 이름을 다시 가리키는 참조.
function classifyFootnoteBracket(rest: string): FootnoteDefNode | FootnoteRefNode {
  if (rest.startsWith(" ")) {
    return { type: "footnote-def", name: null, content: parseInline(rest.slice(1)) };
  }

  const spaceIndex = rest.search(/\s/);
  if (spaceIndex === -1) {
    if (rest.length === 0) return { type: "footnote-def", name: null, content: [] };
    return { type: "footnote-ref", name: rest };
  }

  const name = rest.slice(0, spaceIndex);
  const content = rest.slice(spaceIndex + 1);
  return { type: "footnote-def", name, content: parseInline(content) };
}

// "[ruby(글자, ruby=루비)]"의 괄호 안 인자를 해석한다. 첫 번째 콤마 앞은 루비를 달
// 원문 글자, 그 뒤는 key=value 쌍인데 지금은 ruby= 하나만 알아듣는다(나무마크도
// color=/size= 등을 지원하지만 범위를 최소로 잡는다). 글자나 ruby가 비면 null.
function classifyRubyMacro(args: string): MacroRubyNode | null {
  const parts = args.split(",");
  const text = (parts[0] ?? "").trim();
  let ruby = "";
  for (const part of parts.slice(1)) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key === "ruby") ruby = value;
  }
  if (!text || !ruby) return null;
  return { type: "macro-ruby", text, ruby };
}

// "[include(틀:이름, 인자=값, ...)]"의 괄호 안 인자를 해석한다. 첫 콤마 앞은 틀
// full_title, 그 뒤는 전부 key=value 인자다(틀 본문의 "@key@"를 이 값으로 치환한다 -
// 실제 치환은 lib/wiki/include.ts에서 DB 조회 후 한다). 대상이 비어 있으면 null.
function classifyIncludeArgs(args: string): { target: string; params: Record<string, string> } | null {
  const parts = args.split(",");
  const target = (parts[0] ?? "").trim();
  if (!target) return null;

  const params: Record<string, string> = {};
  for (const part of parts.slice(1)) {
    const eqIndex = part.indexOf("=");
    if (eqIndex === -1) continue;
    const key = part.slice(0, eqIndex).trim();
    const value = part.slice(eqIndex + 1).trim();
    if (key) params[key] = value;
  }
  return { target, params };
}

const INCLUDE_LINE = /^\[include\((.+)\)\]$/;

// 줄 전체(앞뒤 공백 제외)가 정확히 "[include(...)]"인지 확인한다. parseDocument의
// 블록 단위 판별에서 쓴다 - 이걸 통과해야 문단이 아니라 include-block이 된다.
function parseIncludeLine(text: string): { target: string; params: Record<string, string> } | null {
  const match = INCLUDE_LINE.exec(text.trim());
  if (!match) return null;
  return classifyIncludeArgs(match[1]);
}

// "[macro]" / "[macro(인자)]" 형태의 매크로 문법을 해석한다. [date]/[age]/[dday]는
// "지금" 시각에, [pagecount]/[include(...)]는 DB에 의존하지만 그 값 자체는 렌더
// 시점에 채워 넣는다(파서는 순수 함수로 남아야 하므로 여기서는 문법만 인식한 노드를
// 만든다). [include(...)]는 한 줄 전체를 차지할 때만(§ parseDocument) 실제로
// 전개되는 블록이 되고, 여기서는 문장에 섞여 쓰인 경우의 인라인 표시만 만든다.
function classifyMacroBracket(inner: string): InlineNode | null {
  if (inner === "br") return { type: "linebreak" };
  if (inner === "목차" || inner === "tableofcontents") return { type: "macro-toc" };
  if (inner === "date") return { type: "macro-date" };
  if (inner === "pagecount") return { type: "macro-pagecount" };

  const ageMatch = /^age\((.+)\)$/.exec(inner);
  if (ageMatch) return { type: "macro-age", date: ageMatch[1].trim() };

  const ddayMatch = /^dday\((.+)\)$/.exec(inner);
  if (ddayMatch) return { type: "macro-dday", date: ddayMatch[1].trim() };

  const anchorMatch = /^anchor\((.+)\)$/.exec(inner);
  if (anchorMatch) return { type: "macro-anchor", name: anchorMatch[1].trim() };

  const rubyMatch = /^ruby\((.+)\)$/.exec(inner);
  if (rubyMatch) return classifyRubyMacro(rubyMatch[1]);

  const includeMatch = /^include\((.+)\)$/.exec(inner);
  if (includeMatch) {
    const parsed = classifyIncludeArgs(includeMatch[1]);
    return parsed ? { type: "macro-include", target: parsed.target, params: parsed.params } : null;
  }

  return null;
}

// "[...]" 한 겹짜리 대괄호 문법(각주, 매크로)을 해석한다. 알아듣지 못하면 null을
// 반환하고, 호출부에서 대괄호를 서식으로 취급하지 않고 그냥 글자로 남긴다.
function classifyBracket(inner: string): InlineNode | null {
  if (inner.startsWith("*")) {
    return classifyFootnoteBracket(inner.slice(1));
  }
  if (inner === "각주") {
    return { type: "footnote-list" };
  }
  return classifyMacroBracket(inner);
}

// 잘못 닫히거나 안 닫힌 서식 마커는 예외를 던지지 않고 원문 그대로 남긴다.
export function parseInline(text: string): InlineNode[] {
  const stack: Frame[] = [];
  const root: InlineNode[] = [];
  let buffer = "";

  const currentChildren = (): InlineNode[] =>
    stack.length ? stack[stack.length - 1].children : root;

  const flushText = () => {
    if (buffer) {
      currentChildren().push({ type: "text", value: buffer });
      buffer = "";
    }
  };

  let i = 0;
  while (i < text.length) {
    if (text.startsWith("[[", i)) {
      const closeIndex = text.indexOf("]]", i + 2);
      if (closeIndex !== -1) {
        flushText();
        const inner = text.slice(i + 2, closeIndex);
        const parts = inner.split("|");
        currentChildren().push(classifyLink(parts[0], parts.slice(1)));
        i = closeIndex + 2;
        continue;
      }
      // 닫는 ]]가 없으면 링크로 취급하지 않고 아래에서 한 글자씩 그대로 소비한다.
    }

    if (text.startsWith("{{{", i)) {
      const closeIndex = text.indexOf("}}}", i + 3);
      if (closeIndex !== -1) {
        flushText();
        const inner = text.slice(i + 3, closeIndex);
        currentChildren().push(classifyInlineBrace(inner));
        i = closeIndex + 3;
        continue;
      }
      // 닫는 }}}가 없으면 아래에서 한 글자씩 그대로 소비한다.
    }

    if (text[i] === "[" && !text.startsWith("[[", i)) {
      const closeIndex = text.indexOf("]", i + 1);
      if (closeIndex !== -1) {
        const inner = text.slice(i + 1, closeIndex);
        const node = classifyBracket(inner);
        if (node) {
          flushText();
          currentChildren().push(node);
          i = closeIndex + 1;
          continue;
        }
      }
      // 각주/매크로로 인식하지 못하면 대괄호를 그냥 글자로 취급한다.
    }

    const marker = INLINE_MARKERS.find((m) => text.startsWith(m.token, i));
    if (!marker) {
      buffer += text[i];
      i++;
      continue;
    }

    let matchedIndex = -1;
    for (let k = stack.length - 1; k >= 0; k--) {
      if (stack[k].type === marker.type) {
        matchedIndex = k;
        break;
      }
    }

    if (matchedIndex === -1) {
      // 새 서식 시작
      flushText();
      stack.push({ type: marker.type, token: marker.token, children: [] });
      i += marker.token.length;
      continue;
    }

    if (matchedIndex === stack.length - 1) {
      // 가장 최근에 연 서식을 정상적으로 닫는다.
      flushText();
      const frame = stack.pop()!;
      currentChildren().push({ type: frame.type, children: frame.children });
      i += marker.token.length;
      continue;
    }

    // 다른 서식과 어긋나게 겹쳐진 마커: 서식으로 처리하지 않고 글자 그대로 취급한다.
    buffer += marker.token;
    i += marker.token.length;
  }

  flushText();

  // 끝까지 안 닫힌 서식은 여는 마커를 텍스트로 남기고 내용은 상위로 풀어낸다.
  while (stack.length) {
    const frame = stack.pop()!;
    const parent = currentChildren();
    parent.push({ type: "text", value: frame.token });
    parent.push(...frame.children);
  }

  return root;
}

type ListItemToken = Extract<BlockToken, { type: "list-item" }>;

function isListItem(token: BlockToken): token is ListItemToken {
  return token.type === "list-item";
}

// indent가 더 큰 다음 항목들을 재귀적으로 하위 리스트로 묶는다. 같은 indent라도
// 마커 종류(style)가 바뀌면 별개의 리스트로 취급하고 그 지점에서 멈춘다.
function parseListItems(tokens: BlockToken[], start: number): [ListNode, number] {
  const first = tokens[start];
  if (!isListItem(first)) {
    // 호출 규약상 항상 list-item에서 시작하지만, 방어적으로 빈 리스트를 반환한다.
    return [{ type: "list", style: "unordered", items: [] }, start];
  }

  const indent = first.indent;
  const style = first.style;
  const items: ListItemNode[] = [];
  let i = start;

  while (i < tokens.length) {
    const token = tokens[i];
    if (!isListItem(token) || token.indent !== indent || token.style !== style) break;

    const children = parseInline(token.text);
    i++;

    let sublist: ListNode | null = null;
    const next = tokens[i];
    if (next && isListItem(next) && next.indent > indent) {
      const [nested, nextIndex] = parseListItems(tokens, i);
      sublist = nested;
      i = nextIndex;
    }

    items.push({ type: "list-item", children, sublist });
  }

  return [{ type: "list", style, items }, i];
}

type QuoteToken = Extract<BlockToken, { type: "quote" }>;

function isQuote(token: BlockToken): token is QuoteToken {
  return token.type === "quote";
}

// 같은 depth의 연속된 인용 줄을 한 문단처럼 묶고, depth가 더 깊어지면 재귀적으로
// 중첩 인용을 만든다. 중첩 인용 다음에 얕은 depth가 다시 나오면 별개의 인용 블록으로 취급한다.
function parseQuote(tokens: BlockToken[], start: number): [QuoteNode, number] {
  const first = tokens[start];
  if (!isQuote(first)) {
    // 호출 규약상 항상 quote에서 시작하지만, 방어적으로 빈 인용을 반환한다.
    return [{ type: "quote", children: [], nested: null }, start];
  }

  const depth = first.depth;
  const lines: string[] = [];
  let i = start;

  while (i < tokens.length) {
    const token = tokens[i];
    if (!isQuote(token) || token.depth !== depth) break;
    lines.push(token.text);
    i++;
  }

  const children: InlineNode[] = [];
  lines.forEach((line, index) => {
    if (index > 0) children.push({ type: "linebreak" });
    children.push(...parseInline(line));
  });

  let nested: QuoteNode | null = null;
  const next = tokens[i];
  if (next && isQuote(next) && next.depth > depth) {
    const [nestedQuote, nextIndex] = parseQuote(tokens, i);
    nested = nestedQuote;
    i = nextIndex;
  }

  return [{ type: "quote", children, nested }, i];
}

type TableRowToken = Extract<BlockToken, { type: "table-row" }>;

function isTableRow(token: BlockToken): token is TableRowToken {
  return token.type === "table-row";
}

type CellTagResult = {
  colspan: number | null;
  rowspan: number | null;
  bgcolor: string | null;
  width: string | null;
  tableAlign: string | null;
  tableWidth: string | null;
  tableBgcolor: string | null;
  rest: string;
};

// 셀 앞에 붙는 <...> 옵션 태그들을 반복해서 벗겨낸다. <table ...>는 표 전체 옵션,
// <-N>/<|N>은 셀 병합(가로/세로), 그 외 key=value는 셀 옵션(bgcolor, width)이다.
// 알 수 없는 태그는 조용히 건너뛴다(파서는 크래시하지 않는다).
function extractCellTags(text: string): CellTagResult {
  const result: CellTagResult = {
    colspan: null,
    rowspan: null,
    bgcolor: null,
    width: null,
    tableAlign: null,
    tableWidth: null,
    tableBgcolor: null,
    rest: text,
  };

  while (true) {
    const match = /^<([^<>]*)>/.exec(result.rest);
    if (!match) break;

    const content = match[1].trim();
    result.rest = result.rest.slice(match[0].length);

    const tableMatch = /^table\s+(\w+)=(.+)$/.exec(content);
    if (tableMatch) {
      const [, key, value] = tableMatch;
      if (key === "align") result.tableAlign = value;
      else if (key === "width") result.tableWidth = value;
      else if (key === "bgcolor") result.tableBgcolor = value;
      continue;
    }

    const colspanMatch = /^-(\d+)$/.exec(content);
    if (colspanMatch) {
      result.colspan = Number(colspanMatch[1]);
      continue;
    }

    const rowspanMatch = /^\|(\d+)$/.exec(content);
    if (rowspanMatch) {
      result.rowspan = Number(rowspanMatch[1]);
      continue;
    }

    const kvMatch = /^(\w+)=(.+)$/.exec(content);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      if (key === "bgcolor") result.bgcolor = value;
      else if (key === "width") result.width = value;
    }
  }

  result.rest = result.rest.trim();
  return result;
}

// 연속된 표 행 토큰을 하나의 표 블록으로 묶는다. 표 전체 옵션(<table ...>)은
// 첫 행 첫 셀에서만 읽는다.
function parseTable(tokens: BlockToken[], start: number): [TableNode, number] {
  const rows: TableRowNode[] = [];
  let align: string | null = null;
  let width: string | null = null;
  let bgcolor: string | null = null;
  let i = start;
  let isFirstRow = true;

  while (i < tokens.length) {
    const token = tokens[i];
    if (!isTableRow(token)) break;

    const cells: TableCellNode[] = token.cells.map((rawCell, cellIndex) => {
      const tags = extractCellTags(rawCell);
      if (isFirstRow && cellIndex === 0) {
        align = tags.tableAlign ?? align;
        width = tags.tableWidth ?? width;
        bgcolor = tags.tableBgcolor ?? bgcolor;
      }
      return {
        type: "table-cell",
        children: parseInline(tags.rest),
        colspan: tags.colspan ?? 1,
        rowspan: tags.rowspan ?? 1,
        bgcolor: tags.bgcolor,
        width: tags.width,
      };
    });

    rows.push({ type: "table-row", cells });
    isFirstRow = false;
    i++;
  }

  return [{ type: "table", align, width, bgcolor, rows }, i];
}

const ALLOWED_STYLE_PROPS = new Set([
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "font-style",
  "text-align",
  "text-decoration",
  "border",
  "border-radius",
  "padding",
  "margin",
]);

// "color:red;font-weight:bold" 같은 style 문자열에서 안전한 속성만 골라 객체로 만든다.
// url()/expression()/javascript: 값이 섞인 선언은 통째로 버린다(외부 라이브러리 없이
// 최소한의 허용 목록 방식으로 CSS 인젝션을 막는다).
function parseSafeStyle(style: string | undefined): Record<string, string> | null {
  if (!style) return null;
  const result: Record<string, string> = {};
  for (const declaration of style.split(";")) {
    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;
    const prop = declaration.slice(0, colonIndex).trim().toLowerCase();
    const value = declaration.slice(colonIndex + 1).trim();
    if (!value || !ALLOWED_STYLE_PROPS.has(prop)) continue;
    if (/url\(|expression\(|javascript:/i.test(value)) continue;
    const camelProp = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    result[camelProp] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

type BlockDirective =
  | { kind: "code"; language: string | null }
  | { kind: "html" }
  | { kind: "wiki"; style: Record<string, string> | null }
  | { kind: "folding"; title: string }
  | { kind: "size"; delta: number }
  | { kind: "color"; color: string };

// "{{{" 뒤에 붙는 지시어 문자열을 해석한다. 못 알아듣는 지시어는 코드 블록으로 안전하게
// 처리한다(파서는 크래시하지 않는다).
function classifyBlockDirective(info: string): BlockDirective {
  const trimmed = info.trim();
  if (trimmed === "") return { kind: "code", language: null };

  const syntaxMatch = /^#!syntax\s+(\S+)/.exec(trimmed);
  if (syntaxMatch) return { kind: "code", language: syntaxMatch[1] };

  if (/^#!html\b/.test(trimmed)) return { kind: "html" };

  const wikiMatch = /^#!wiki(?:\s+style=(?:"([^"]*)"|'([^']*)'))?/.exec(trimmed);
  if (wikiMatch) return { kind: "wiki", style: parseSafeStyle(wikiMatch[1] ?? wikiMatch[2]) };

  const foldingMatch = /^#!folding\s*(.*)$/.exec(trimmed);
  if (foldingMatch) return { kind: "folding", title: foldingMatch[1].trim() || "펼치기" };

  const sizeMatch = /^([+-])(\d)$/.exec(trimmed);
  if (sizeMatch) {
    const sign = sizeMatch[1] === "-" ? -1 : 1;
    return { kind: "size", delta: sign * Math.min(Number(sizeMatch[2]), 5) };
  }

  // "#!"로 시작하는 건 (위에서 못 걸러진) 지시어이지 색상이 아니다 - 제외한다.
  const colorMatch = /^#(?!!)(\S+)$/.exec(trimmed);
  if (colorMatch) return { kind: "color", color: colorMatch[1] };

  return { kind: "code", language: null };
}

type BlockContentToken = Extract<BlockToken, { type: "block-content" }>;

// block-open 다음(block-close 전까지)의 원문 줄들을 모은다. block-close가 없으면
// (파일이 중간에 끝나면) 있는 만큼만 가져온다.
function collectBlockContentLines(tokens: BlockToken[], start: number): [string[], number] {
  const lines: string[] = [];
  let i = start;
  while (i < tokens.length && tokens[i].type === "block-content") {
    lines.push((tokens[i] as BlockContentToken).text);
    i++;
  }
  if (i < tokens.length && tokens[i].type === "block-close") {
    i++;
  }
  return [lines, i];
}

// wiki/folding/size/color 블록은 안쪽 내용을 다시 위키 문법으로 재귀 파싱해야 하므로
// 순환 방지용 depth를 이어서 넘긴다.
function parseBlockFence(
  tokens: BlockToken[],
  start: number,
  depth: number,
): [BlockNode, number] {
  const openToken = tokens[start];
  if (!openToken || openToken.type !== "block-open") {
    // 호출 규약상 항상 block-open에서 시작하지만, 방어적으로 빈 코드 블록을 반환한다.
    return [{ type: "code-block", language: null, content: "" }, start];
  }

  const directive = classifyBlockDirective(openToken.info);
  const [lines, next] = collectBlockContentLines(tokens, start + 1);
  const rawContent = lines.join("\n");

  switch (directive.kind) {
    case "code":
      return [{ type: "code-block", language: directive.language, content: rawContent }, next];
    case "html":
      return [{ type: "html-block", content: rawContent }, next];
    case "wiki":
      return [
        {
          type: "wiki-block",
          style: directive.style,
          children: parseDocument(rawContent, depth + 1).children,
        },
        next,
      ];
    case "folding":
      return [
        {
          type: "folding-block",
          title: parseInline(directive.title),
          children: parseDocument(rawContent, depth + 1).children,
        },
        next,
      ];
    case "size":
      return [
        {
          type: "size-block",
          delta: directive.delta,
          children: parseDocument(rawContent, depth + 1).children,
        },
        next,
      ];
    case "color":
      return [
        {
          type: "color-block",
          color: directive.color,
          children: parseDocument(rawContent, depth + 1).children,
        },
        next,
      ];
  }
}

// #!wiki/#!folding/+N/#색상 블록이 서로를 감싸며 무한히 중첩되는 걸 막는 안전장치.
const MAX_NESTING_DEPTH = 20;

function parseDocument(source: string, depth = 0): DocumentNode {
  if (depth > MAX_NESTING_DEPTH) {
    return {
      type: "document",
      children: [{ type: "paragraph", children: [{ type: "text", value: source }] }],
    };
  }

  const tokens = tokenizeBlocks(source);
  const blocks: BlockNode[] = [];
  let paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const children: InlineNode[] = [];
    paragraphLines.forEach((line, index) => {
      if (index > 0) children.push({ type: "linebreak" });
      children.push(...parseInline(line));
    });
    blocks.push({ type: "paragraph", children });
    paragraphLines = [];
  };

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i];

    if (token.type === "blank") {
      flushParagraph();
      i++;
    } else if (token.type === "heading") {
      flushParagraph();
      blocks.push({ type: "heading", level: token.level, children: parseInline(token.text) });
      i++;
    } else if (token.type === "list-item") {
      flushParagraph();
      const [list, next] = parseListItems(tokens, i);
      blocks.push(list);
      i = next;
    } else if (token.type === "quote") {
      flushParagraph();
      const [quote, next] = parseQuote(tokens, i);
      blocks.push(quote);
      i = next;
    } else if (token.type === "table-row") {
      flushParagraph();
      const [table, next] = parseTable(tokens, i);
      blocks.push(table);
      i = next;
    } else if (token.type === "hr") {
      flushParagraph();
      blocks.push({ type: "hr" });
      i++;
    } else if (token.type === "block-open") {
      flushParagraph();
      const [block, next] = parseBlockFence(tokens, i, depth);
      blocks.push(block);
      i = next;
    } else if (token.type === "block-content" || token.type === "block-close") {
      // 정상 흐름에서는 block-open 처리 중에 이미 소비된다. 여기 도달했다면
      // (예상 못한 토큰 배열) 그냥 건너뛴다 - 절대 크래시하지 않는다.
      i++;
    } else if (token.type === "text" && parseIncludeLine(token.text) !== null) {
      // 줄 전체가 정확히 "[include(...)]"일 때만 블록으로 전개한다(문단 문법과
      // 헷갈리지 않도록 - 문장에 섞여 쓰이면 parseInline이 인라인 표시로 처리한다).
      flushParagraph();
      const include = parseIncludeLine(token.text)!;
      blocks.push({ type: "include-block", target: include.target, params: include.params });
      i++;
    } else {
      paragraphLines.push(token.text);
      i++;
    }
  }
  flushParagraph();

  return { type: "document", children: blocks };
}

// AST 전체를 순회하며 모든 InlineNode에 visit()을 한 번씩 호출한다. 빨간 링크 판정용
// 내부 링크 목록, 분류 목록 등 AST를 훑어야 하는 여러 기능이 이 순회를 공유한다.
function walkInline(nodes: InlineNode[], visit: (node: InlineNode) => void) {
  for (const node of nodes) {
    visit(node);
    switch (node.type) {
      case "internal-link":
      case "anchor-link":
      case "external-link":
        if (node.children) walkInline(node.children, visit);
        break;
      case "file-link":
      case "category-link":
      case "text":
      case "linebreak":
      case "inline-code":
      case "footnote-ref":
      case "footnote-list":
      case "macro-toc":
      case "macro-date":
      case "macro-age":
      case "macro-dday":
      case "macro-ruby":
      case "macro-anchor":
      case "macro-pagecount":
      case "macro-include":
        break;
      case "footnote-def":
        walkInline(node.content, visit);
        break;
      default:
        walkInline(node.children, visit);
    }
  }
}

function walkBlocks(blocks: BlockNode[], visit: (node: InlineNode) => void) {
  for (const block of blocks) {
    switch (block.type) {
      case "list":
        for (const item of block.items) {
          walkInline(item.children, visit);
          if (item.sublist) walkBlocks([item.sublist], visit);
        }
        break;
      case "quote":
        walkInline(block.children, visit);
        if (block.nested) walkBlocks([block.nested], visit);
        break;
      case "hr":
      case "redirect":
      case "include-block":
        // 틀 내용은 파서가 조회하지 않으므로 훑을 게 없다(빨간 링크/분류/각주 수집은
        // lib/wiki/include.ts가 틀 내용을 따로 parse()한 뒤 그 결과에 대해 수행한다).
        break;
      case "table":
        for (const row of block.rows) {
          for (const cell of row.cells) walkInline(cell.children, visit);
        }
        break;
      case "code-block":
      case "html-block":
        // 코드/HTML 블록은 원문 그대로다 - 위키 인라인 문법으로 다시 훑지 않는다.
        break;
      case "wiki-block":
      case "size-block":
      case "color-block":
        walkBlocks(block.children, visit);
        break;
      case "folding-block":
        walkInline(block.title, visit);
        walkBlocks(block.children, visit);
        break;
      default:
        walkInline(block.children, visit);
    }
  }
}

// AST 생성 후 빨간 링크(존재하지 않는 문서) 판정을 위해 내부/파일 링크 대상 full_title들을
// 모은다. 분류 링크는 별개 개념이라 collectCategoryTargets()에서 따로 모은다.
// 파서 자신은 DB를 조회하지 않는 순수 함수로 남기고, 존재 여부는 별도 단계에서 확인한다.
export function collectInternalLinkTargets(doc: DocumentNode): string[] {
  const targets = new Set<string>();
  walkBlocks(doc.children, (node) => {
    if (node.type === "internal-link" || node.type === "file-link") targets.add(node.target);
  });
  return [...targets];
}

// [[분류:이름]]은 본문 어디에 써도 그 자리엔 아무것도 렌더되지 않고, 문서 하단에
// 모아서 표시한다(§6 10단계). 저장 시 document_categories 반정규화에도 이 목록을 쓴다.
export function collectCategoryTargets(doc: DocumentNode): string[] {
  const targets = new Set<string>();
  walkBlocks(doc.children, (node) => {
    if (node.type === "category-link") targets.add(node.target);
  });
  return [...targets];
}

// include-block은 문서 최상위, 또는 wiki/folding/size/color 블록(및 그 중첩) 안에만
// 나타날 수 있다 - list-item/quote/table-cell 내용은 parseInline으로 만들어지므로
// 애초에 이 블록 타입이 생길 수 없다. DB 조회가 필요한 실제 전개(lib/wiki/include.ts)가
// "무엇을, 어떤 인자로" 가져와야 하는지 알기 위해 먼저 이 목록을 훑는다.
export function collectIncludeDirectives(
  doc: DocumentNode,
): { target: string; params: Record<string, string> }[] {
  const found: { target: string; params: Record<string, string> }[] = [];

  const walk = (blocks: BlockNode[]) => {
    for (const block of blocks) {
      switch (block.type) {
        case "include-block":
          found.push({ target: block.target, params: block.params });
          break;
        case "wiki-block":
        case "folding-block":
        case "size-block":
        case "color-block":
          walk(block.children);
          break;
        case "list":
          for (const item of block.items) if (item.sublist) walk([item.sublist]);
          break;
        case "quote":
          if (block.nested) walk([block.nested]);
          break;
        default:
          break;
      }
    }
  };

  walk(doc.children);
  return found;
}

export type FootnoteEntry = { number: number; content: InlineNode[] };

// 각주는 등장 순서대로 번호를 매기고, 이름만 있는 참조(footnote-ref)는 같은 이름의
// 정의(footnote-def)가 받은 번호에 연결한다. AST 자체는 건드리지 않고(파서는 순수
// 함수로 남는다) 노드 객체를 키로 쓰는 Map으로 번호를 따로 들고 있다가, 렌더러가
// 그 Map으로 각 노드의 번호를 찾아 쓴다.
export function collectFootnotes(doc: DocumentNode): {
  numberByNode: Map<InlineNode, number>;
  entries: FootnoteEntry[];
} {
  const numberByNode = new Map<InlineNode, number>();
  const entries: FootnoteEntry[] = [];
  const nameToNumber = new Map<string, number>();

  walkBlocks(doc.children, (node) => {
    if (node.type !== "footnote-def") return;
    const number = entries.length + 1;
    numberByNode.set(node, number);
    entries.push({ number, content: node.content });
    if (node.name) nameToNumber.set(node.name, number);
  });

  walkBlocks(doc.children, (node) => {
    if (node.type !== "footnote-ref") return;
    const number = nameToNumber.get(node.name);
    if (number) numberByNode.set(node, number);
  });

  return { numberByNode, entries };
}

// [각주] 매크로가 문서 어딘가에 이미 쓰였는지 확인한다. 안 쓰였다면 렌더러가
// 각주 목록을 문서 맨 끝에 자동으로 붙인다.
export function hasFootnoteListMacro(doc: DocumentNode): boolean {
  let found = false;
  walkBlocks(doc.children, (node) => {
    if (node.type === "footnote-list") found = true;
  });
  return found;
}

// [목차]/[tableofcontents]가 본문 어딘가에 이미 쓰였는지 확인한다. 쓰였다면 페이지가
// 문서 맨 위에 따로 목차 상자를 또 띄우지 않는다(각주와 같은 "쓰면 그 자리, 안 쓰면
// 자동 배치" 패턴).
export function hasTocMacro(doc: DocumentNode): boolean {
  let found = false;
  walkBlocks(doc.children, (node) => {
    if (node.type === "macro-toc") found = true;
  });
  return found;
}

// [pagecount]는 DB 조회가 필요해서 파서 자신은 계산하지 못한다. 문서에 이 매크로가
// 실제로 쓰였을 때만 페이지 컴포넌트가 조회를 하도록, AST만 보고 미리 판별한다.
export function hasPagecountMacro(doc: DocumentNode): boolean {
  let found = false;
  walkBlocks(doc.children, (node) => {
    if (node.type === "macro-pagecount") found = true;
  });
  return found;
}

const REDIRECT_LINE = /^#redirect\s+(.+?)\s*$/;

// "#redirect 문서명"이 원문 첫 줄에 있는지 확인한다. 있으면 넘겨줄 대상 문서명을,
// 없으면 null을 돌려준다. 문서 저장(create_revision RPC)이 이 값으로
// documents.redirect_target을 동기화한다(§6 10단계) - 파서는 문법만 인식하고
// DB 반영은 별도 단계에서 한다(파서는 순수 함수로 남는다).
export function extractRedirectTarget(source: string): string | null {
  const firstLine = source.split("\n", 1)[0] ?? "";
  const match = REDIRECT_LINE.exec(firstLine);
  return match ? match[1] : null;
}

// 파서는 절대 크래시하지 않는다: 예상 못한 입력은 원문을 그대로 문단 하나로 감싸 반환한다.
export function parse(source: string): DocumentNode {
  try {
    const redirectTarget = extractRedirectTarget(source);
    if (redirectTarget === null) {
      return parseDocument(source);
    }
    // 첫 줄은 넘겨주기 표시로 소비하고, 그 아래 줄부터는(보통 비어 있지만) 평소대로 파싱한다.
    const rest = source.split("\n").slice(1).join("\n");
    const restDoc = parseDocument(rest);
    return {
      type: "document",
      children: [{ type: "redirect", target: redirectTarget }, ...restDoc.children],
    };
  } catch {
    return {
      type: "document",
      children: [{ type: "paragraph", children: [{ type: "text", value: source }] }],
    };
  }
}
