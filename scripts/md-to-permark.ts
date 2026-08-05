import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

// CommonMark 전체를 구현하진 않고, 실제 노트/README에서 흔히 쓰는 구문만 다룬다:
// 제목, 굵게/기울임/취소선, 인라인 코드, 링크, 이미지, 순서/비순서 리스트(+ 체크박스),
// 인용, 수평선, 펜스 코드 블록, GFM 표. 각주·정의 목록·참조 링크·HTML 블록은 다루지
// 않고 원문을 그대로 통과시킨다 - 변환 후 결과를 한 번 훑어봐야 한다.
//
// {{{#!syntax}}} 코드 블록 구문은 퍼마크 파서 7단계(아직 미구현) 대상이라, 지금은
// 변환은 되지만 사이트에서 특별히 렌더되지 않고 원문 그대로 보인다.

const ATX_HEADING = /^(#{1,6})\s+(.*?)\s*#*$/;
const HR_MARKDOWN = /^ {0,3}([-*_])(?: *\1){2,} *$/;
const FENCE = /^(?:```|~~~)\s*([\w+-]*)\s*$/;
const TASK_ITEM = /^(\s*)[-+*]\s+\[([ xX])\]\s+(.*)$/;
const UNORDERED_ITEM = /^(\s*)[-+*]\s+(.*)$/;
const ORDERED_ITEM = /^(\s*)(\d+)\.\s+(.*)$/;
const QUOTE = /^(\s*)(>+)\s?(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

// 일반 텍스트에 나타날 일이 거의 없는 표식으로 감싸 코드 스팬을 임시로 숨긴다.
// 뒤이어 도는 굵게/기울임/링크 변환이 코드 안의 특수문자를 건드리지 않게 하기 위함이다.
const PLACEHOLDER_PREFIX = "PERMARK_PLACEHOLDER_";

function convertInlineCode(line: string, placeholders: string[]): string {
  return line.replace(/`([^`]+)`/g, (_match, code: string) => {
    placeholders.push(`{{{${code}}}}`);
    return `${PLACEHOLDER_PREFIX}${placeholders.length - 1}`;
  });
}

function convertImages(line: string): string {
  return line.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_match, alt: string, src: string) => (alt ? `[[파일:${src}|alt=${alt}]]` : `[[파일:${src}]]`),
  );
}

function convertLinks(line: string): string {
  return line.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_match, text: string, url: string) => {
      if (url.startsWith("#") || /^https?:\/\//.test(url)) return `[[${url}|${text}]]`;
      return `[[${url.replace(/\.md$/i, "")}|${text}]]`;
    },
  );
}

function convertBoldItalic(line: string): string {
  return line
    .replace(/\*\*([^*]+)\*\*/g, "'''$1'''")
    .replace(/__([^_]+)__/g, "'''$1'''")
    .replace(/\*([^*]+)\*/g, "''$1''")
    .replace(/\b_([^_]+)_\b/g, "''$1''");
}

// 취소선(~~text~~)은 퍼마크 문법과 동일해 변환 없이 그대로 둔다.
export function convertInline(line: string): string {
  const placeholders: string[] = [];
  let result = convertInlineCode(line, placeholders);
  result = convertImages(result);
  result = convertLinks(result);
  result = convertBoldItalic(result);

  const restorePattern = new RegExp(`${PLACEHOLDER_PREFIX}(\\d+)`, "g");
  return result.replace(restorePattern, (_match, index: string) => placeholders[Number(index)]);
}

function convertTableRow(line: string): string {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => convertInline(cell.trim()));
  return `|| ${cells.join(" || ")} ||`;
}

export function convertMarkdownToPerMark(source: string): string {
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.replace(/^\t+/, (tabs) => "    ".repeat(tabs.length)));
  const output: string[] = [];

  let inFence = false;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const fence = FENCE.exec(line.trim());
    if (fence) {
      if (inFence) {
        output.push("}}}");
      } else {
        output.push(fence[1] ? `{{{#!syntax ${fence[1]}` : "{{{");
      }
      inFence = !inFence;
      i++;
      continue;
    }

    if (inFence) {
      output.push(line);
      i++;
      continue;
    }

    if (
      line.includes("|") &&
      i + 1 < lines.length &&
      lines[i + 1].includes("-") &&
      TABLE_SEPARATOR.test(lines[i + 1])
    ) {
      output.push(convertTableRow(line));
      i += 2; // 헤더 행 + 구분선(---|---) 건너뛰기
      while (i < lines.length && lines[i].trim() !== "" && lines[i].includes("|")) {
        output.push(convertTableRow(lines[i]));
        i++;
      }
      continue;
    }

    const heading = ATX_HEADING.exec(line);
    if (heading) {
      const marker = "=".repeat(heading[1].length);
      output.push(`${marker} ${convertInline(heading[2])} ${marker}`);
      i++;
      continue;
    }

    if (HR_MARKDOWN.test(line)) {
      output.push("----");
      i++;
      continue;
    }

    const task = TASK_ITEM.exec(line);
    if (task) {
      const [, indent, mark, text] = task;
      output.push(`${indent}* ${mark.trim() ? "☑" : "☐"} ${convertInline(text)}`);
      i++;
      continue;
    }

    const unordered = UNORDERED_ITEM.exec(line);
    if (unordered) {
      const [, indent, text] = unordered;
      output.push(`${indent}* ${convertInline(text)}`);
      i++;
      continue;
    }

    const ordered = ORDERED_ITEM.exec(line);
    if (ordered) {
      const [, indent, number, text] = ordered;
      output.push(`${indent}${number}. ${convertInline(text)}`);
      i++;
      continue;
    }

    const quote = QUOTE.exec(line);
    if (quote) {
      const [, , marks, text] = quote;
      output.push(`${marks} ${convertInline(text)}`);
      i++;
      continue;
    }

    output.push(convertInline(line));
    i++;
  }

  return output.join("\n");
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);

if (isDirectRun) {
  const [inputPath, outputPath] = process.argv.slice(2);

  if (!inputPath) {
    console.error("사용법: bun scripts/md-to-permark.ts <입력.md> [출력 파일]");
    process.exit(1);
  }

  const converted = convertMarkdownToPerMark(readFileSync(inputPath, "utf-8"));

  if (outputPath) {
    writeFileSync(outputPath, converted, "utf-8");
    console.log(`변환 완료: ${outputPath}`);
  } else {
    console.log(converted);
  }
}
