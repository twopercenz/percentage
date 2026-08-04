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

export type InlineNode =
  | { type: "text"; value: string }
  | { type: "linebreak" }
  | { type: InlineType; children: InlineNode[] }
  | LinkNode;

export type HeadingNode = { type: "heading"; level: number; children: InlineNode[] };
export type ParagraphNode = { type: "paragraph"; children: InlineNode[] };
export type ListItemNode = { type: "list-item"; children: InlineNode[]; sublist: ListNode | null };
export type ListNode = { type: "list"; style: ListStyle; items: ListItemNode[] };
export type QuoteNode = { type: "quote"; children: InlineNode[]; nested: QuoteNode | null };
export type HrNode = { type: "hr" };

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

export type BlockNode = HeadingNode | ParagraphNode | ListNode | QuoteNode | HrNode | TableNode;
export type DocumentNode = { type: "document"; children: BlockNode[] };

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

function parseDocument(source: string): DocumentNode {
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
        break;
      case "table":
        for (const row of block.rows) {
          for (const cell of row.cells) walkInline(cell.children, visit);
        }
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

// 파서는 절대 크래시하지 않는다: 예상 못한 입력은 원문을 그대로 문단 하나로 감싸 반환한다.
export function parse(source: string): DocumentNode {
  try {
    return parseDocument(source);
  } catch {
    return {
      type: "document",
      children: [{ type: "paragraph", children: [{ type: "text", value: source }] }],
    };
  }
}
