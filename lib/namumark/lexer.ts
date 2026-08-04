export type ListStyle =
  | "unordered"
  | "ordered-numeric"
  | "ordered-roman"
  | "ordered-upper-alpha"
  | "ordered-lower-alpha";

export type BlockToken =
  | { type: "heading"; level: number; text: string }
  | { type: "blank" }
  | { type: "list-item"; indent: number; style: ListStyle; text: string }
  | { type: "quote"; depth: number; text: string }
  | { type: "hr" }
  | { type: "table-row"; cells: string[] }
  | { type: "text"; text: string };

// 줄 앞뒤 공백 없이 정확히 같은 개수의 '='로 감싸야 제목으로 인식한다.
// 백레퍼런스 정규식(/^(={1,6})(.+?)\1\s*$/)은 앞쪽 개수를 역추적하다가
// 여분의 '='를 본문에 삼켜버리는 경우가 있어(예: "== 개요 =" 오탐), 앞/뒤 '=' 런을
// 각각 독립적으로 셈해서 정확히 같은 개수인지 검사한다.
function tryParseHeading(line: string): { level: number; text: string } | null {
  const leadingMatch = /^=+/.exec(line);
  if (!leadingMatch) return null;

  const level = leadingMatch[0].length;
  if (level > 6) return null;

  const trailingMatch = /=+\s*$/.exec(line);
  if (!trailingMatch) return null;

  const trailingEquals = /^=+/.exec(trailingMatch[0])![0].length;
  if (trailingEquals !== level) return null;

  const start = level;
  const end = line.length - trailingMatch[0].length;
  if (end <= start) return null;

  return { level, text: line.slice(start, end).trim() };
}

// 들여쓰기 칸 수 + 마커(*, 1., A., a., I.) + 공백 + 내용. 로마 숫자(IVXLCDM)는
// 알파벳 대문자와 겹치므로, "I." 같은 표기는 알파벳이 아니라 로마 숫자로 해석한다.
const LIST_ITEM_PATTERN = /^( *)(?:(\d+)\.|([IVXLCDM]+)\.|([A-Z])\.|([a-z])\.|(\*))\s(.*)$/;

function tryParseListItem(
  line: string,
): { indent: number; style: ListStyle; text: string } | null {
  const match = LIST_ITEM_PATTERN.exec(line);
  if (!match) return null;

  const [, indent, numeric, roman, upperAlpha, lowerAlpha, , text] = match;

  const style: ListStyle = numeric
    ? "ordered-numeric"
    : roman
      ? "ordered-roman"
      : upperAlpha
        ? "ordered-upper-alpha"
        : lowerAlpha
          ? "ordered-lower-alpha"
          : "unordered";

  return { indent: indent.length, style, text };
}

function tryParseQuote(line: string): { depth: number; text: string } | null {
  const match = /^(>+)\s*(.*)$/.exec(line);
  if (!match) return null;
  return { depth: match[1].length, text: match[2] };
}

// 4개 이상의 '-'만으로 이뤄진 줄은 수평선이다. 인라인 취소선 마커('--')와는
// 블록/인라인 단계가 달라 겹치지 않는다: "--취소선--"처럼 다른 글자가 섞이면
// 이 패턴에 걸리지 않고 일반 텍스트 줄로 내려가 인라인 파서가 처리한다.
function isHorizontalRule(line: string): boolean {
  return /^-{4,}$/.test(line.trim());
}

// "|| 셀 || 셀 ||" 형태 한 줄 전체가 표 행이다. 맨 앞/뒤 || 사이를 ||로 쪼개 셀 원문을 얻는다.
// 옵션 태그(<table align=center>, <-2>, <|2> 등) 해석은 파서 단계에서 한다.
function tryParseTableRow(line: string): { cells: string[] } | null {
  const trimmed = line.trim();
  if (trimmed.length < 4 || !trimmed.startsWith("||") || !trimmed.endsWith("||")) return null;

  return { cells: trimmed.split("||").slice(1, -1) };
}

export function tokenizeBlocks(source: string): BlockToken[] {
  return source.split("\n").map((line): BlockToken => {
    if (line.trim() === "") return { type: "blank" };

    const heading = tryParseHeading(line);
    if (heading) return { type: "heading", ...heading };

    const listItem = tryParseListItem(line);
    if (listItem) return { type: "list-item", ...listItem };

    if (isHorizontalRule(line)) return { type: "hr" };

    const tableRow = tryParseTableRow(line);
    if (tableRow) return { type: "table-row", ...tableRow };

    const quote = tryParseQuote(line);
    if (quote) return { type: "quote", ...quote };

    return { type: "text", text: line };
  });
}
