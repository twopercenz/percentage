import type { ReactNode } from "react";
import Link from "next/link";
import { fullTitleHref } from "@/lib/wiki/title";
import { ChevronIcon } from "@/components/ui/icons";
import type {
  BlockNode,
  DocumentNode,
  HeadingNode,
  InlineNode,
  ListNode,
  ListStyle,
  QuoteNode,
  TableNode,
} from "./parser";

export type RenderContext = {
  // 내부 링크 대상 중 실제로 존재하는 문서의 full_title 집합. 파서는 DB에 접근하지
  // 않으므로, 이 정보는 AST 생성 후 별도 조회 단계에서 주입한다(빨간 링크 판정).
  existingTitles?: Set<string>;
};

type Section = {
  heading: HeadingNode;
  number: string;
  blocks: BlockNode[];
  children: Section[];
};

type RootSection = {
  blocks: BlockNode[];
  children: Section[];
};

function buildSections(blocks: BlockNode[]): RootSection {
  const root: RootSection = { blocks: [], children: [] };
  const stack: (RootSection | Section)[] = [root];
  const counters = [0, 0, 0, 0, 0, 0];

  const levelOf = (section: RootSection | Section): number =>
    "heading" in section ? section.heading.level : 0;

  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level;
      counters[level - 1]++;
      for (let i = level; i < counters.length; i++) counters[i] = 0;
      const number = `${counters.slice(0, level).join(".")}.`;

      while (stack.length > 1 && levelOf(stack[stack.length - 1]) >= level) {
        stack.pop();
      }

      const section: Section = { heading: block, number, blocks: [], children: [] };
      stack[stack.length - 1].children.push(section);
      stack.push(section);
    } else {
      stack[stack.length - 1].blocks.push(block);
    }
  }

  return root;
}

function slugifyAnchor(text: string): string {
  return text.trim().replace(/\s+/g, "_");
}

function inlineToPlainText(nodes: InlineNode[]): string {
  return nodes
    .map((node): string => {
      switch (node.type) {
        case "text":
          return node.value;
        case "linebreak":
          return " ";
        case "internal-link":
          return node.children ? inlineToPlainText(node.children) : node.target;
        case "anchor-link":
          return node.children ? inlineToPlainText(node.children) : node.anchor;
        case "external-link":
          return node.children ? inlineToPlainText(node.children) : node.url;
        case "file-link":
          return node.target;
        case "category-link":
          return "";
        default:
          return inlineToPlainText(node.children);
      }
    })
    .join("");
}

// 색상 유틸리티는 뺀 공통 링크 스타일. 텍스트 색은 사용처에서 정확히 하나만 덧붙인다
// (동일 카테고리 유틸을 문자열 순서로 덮어쓰려 하면 Tailwind 산출 순서에 따라 깨질 수 있다).
const LINK_CLASS = "underline hover:text-[var(--accent-secondary)]";

function renderInlineNodes(nodes: InlineNode[], context: RenderContext): ReactNode[] {
  return nodes.map((node, index) => renderInlineNode(node, index, context));
}

function renderInlineNode(node: InlineNode, key: number, context: RenderContext): ReactNode {
  switch (node.type) {
    case "text":
      return node.value;
    case "linebreak":
      return <br key={key} />;
    case "bold":
      return <strong key={key}>{renderInlineNodes(node.children, context)}</strong>;
    case "italic":
      return <em key={key}>{renderInlineNodes(node.children, context)}</em>;
    case "underline":
      return (
        <span key={key} className="underline">
          {renderInlineNodes(node.children, context)}
        </span>
      );
    case "strikethrough":
      return (
        <span key={key} className="line-through">
          {renderInlineNodes(node.children, context)}
        </span>
      );
    case "superscript":
      return <sup key={key}>{renderInlineNodes(node.children, context)}</sup>;
    case "subscript":
      return <sub key={key}>{renderInlineNodes(node.children, context)}</sub>;
    case "internal-link": {
      const exists = context.existingTitles ? context.existingTitles.has(node.target) : true;
      return (
        <Link
          key={key}
          href={fullTitleHref("/w", node.target)}
          className={
            exists
              ? `text-[var(--accent)] ${LINK_CLASS}`
              : `text-[var(--danger)] decoration-dotted ${LINK_CLASS}`
          }
        >
          {node.children ? renderInlineNodes(node.children, context) : node.target}
        </Link>
      );
    }
    case "anchor-link":
      return (
        <a key={key} href={`#${slugifyAnchor(node.anchor)}`} className={`text-[var(--accent)] ${LINK_CLASS}`}>
          {node.children ? renderInlineNodes(node.children, context) : `#${node.anchor}`}
        </a>
      );
    case "external-link":
      return (
        <a
          key={key}
          href={node.url}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className={`text-[var(--accent)] ${LINK_CLASS}`}
        >
          {node.children ? renderInlineNodes(node.children, context) : node.url}
        </a>
      );
    case "file-link":
      // 파일 업로드/Storage 연동은 P2 범위라, 지금은 해당 파일 문서로 가는 링크로만 표시한다.
      return (
        <Link key={key} href={fullTitleHref("/w", node.target)} className={`text-[var(--accent)] ${LINK_CLASS}`}>
          {node.target}
        </Link>
      );
    case "category-link":
      // 본문 위치엔 아무것도 렌더하지 않는다. 문서 하단 분류 표시는 페이지에서
      // collectCategoryTargets()로 따로 모아 렌더한다.
      return null;
  }
}

function listStyleClass(style: ListStyle): string {
  switch (style) {
    case "unordered":
      return "list-disc";
    case "ordered-numeric":
      return "list-decimal";
    case "ordered-upper-alpha":
      return "[list-style-type:upper-alpha]";
    case "ordered-lower-alpha":
      return "[list-style-type:lower-alpha]";
    case "ordered-roman":
      return "[list-style-type:upper-roman]";
  }
}

function renderList(list: ListNode, key: string, context: RenderContext): ReactNode {
  const items = list.items.map((item, index) => (
    <li key={`${key}-${index}`}>
      {renderInlineNodes(item.children, context)}
      {item.sublist ? renderList(item.sublist, `${key}-${index}`, context) : null}
    </li>
  ));

  const className = `my-2 list-outside pl-6 ${listStyleClass(list.style)}`;

  if (list.style === "unordered") {
    return (
      <ul key={key} className={className}>
        {items}
      </ul>
    );
  }

  return (
    <ol key={key} className={className}>
      {items}
    </ol>
  );
}

function renderQuote(quote: QuoteNode, key: string, context: RenderContext): ReactNode {
  return (
    <blockquote key={key} className="my-3 border-l-4 border-[var(--border)] pl-4 text-[var(--muted)]">
      <p className="leading-7">{renderInlineNodes(quote.children, context)}</p>
      {quote.nested ? renderQuote(quote.nested, `${key}-n`, context) : null}
    </blockquote>
  );
}

function tableAlignClass(align: string | null): string {
  if (align === "center") return "mx-auto";
  if (align === "right") return "ml-auto";
  return "";
}

// 모바일에서는 가로 스크롤 컨테이너로 감싼다(AGENTS.md §8).
function renderTable(table: TableNode, key: string, context: RenderContext): ReactNode {
  return (
    <div key={key} className="my-4 overflow-x-auto">
      <table
        className={`border-collapse border border-[var(--border)] ${tableAlignClass(table.align)}`}
        style={{
          ...(table.width ? { width: table.width } : {}),
          ...(table.bgcolor ? { backgroundColor: table.bgcolor } : {}),
        }}
      >
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={`${key}-r${rowIndex}`}>
              {row.cells.map((cell, cellIndex) => (
                <td
                  key={`${key}-r${rowIndex}-c${cellIndex}`}
                  colSpan={cell.colspan}
                  rowSpan={cell.rowspan}
                  className="border border-[var(--border)] px-3 py-2"
                  style={{
                    ...(cell.width ? { width: cell.width } : {}),
                    ...(cell.bgcolor ? { backgroundColor: cell.bgcolor } : {}),
                  }}
                >
                  {renderInlineNodes(cell.children, context)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderBlock(block: BlockNode, key: string, context: RenderContext): ReactNode {
  switch (block.type) {
    case "paragraph":
      return (
        <p key={key} className="my-3 leading-7">
          {renderInlineNodes(block.children, context)}
        </p>
      );
    case "list":
      return renderList(block, key, context);
    case "quote":
      return renderQuote(block, key, context);
    case "table":
      return renderTable(block, key, context);
    case "hr":
      return <hr key={key} className="my-6 border-[var(--border)]" />;
    case "heading":
      // buildSections()가 heading을 별도로 소비하므로 blocks 배열에는 남지 않는다.
      return null;
  }
}

function renderSectionBody(section: RootSection | Section, key: string, context: RenderContext): ReactNode {
  return (
    <>
      {section.blocks.map((block, index) => renderBlock(block, `${key}-b${index}`, context))}
      {section.children.map((child, index) => renderSection(child, `${key}-s${index}`, context))}
    </>
  );
}

function renderSection(section: Section, key: string, context: RenderContext): ReactNode {
  const level = Math.min(section.heading.level, 6);
  const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const anchorId = slugifyAnchor(inlineToPlainText(section.heading.children));

  return (
    <details key={key} id={anchorId} open className="group my-4">
      <summary className="flex cursor-pointer list-none items-center gap-1">
        <ChevronIcon className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
        <HeadingTag className="inline text-lg font-bold text-[var(--accent-warm)]">
          <span className="mr-2 text-sm font-normal text-[var(--muted)]">{section.number}</span>
          {renderInlineNodes(section.heading.children, context)}
        </HeadingTag>
      </summary>
      <div className="mt-1 pl-5">{renderSectionBody(section, key, context)}</div>
    </details>
  );
}

export function renderDocument(document: DocumentNode, context: RenderContext = {}): ReactNode {
  const root = buildSections(document.children);
  return renderSectionBody(root, "root", context);
}

export type TocEntry = {
  level: number;
  number: string;
  title: string;
  anchorId: string;
  children: TocEntry[];
};

// 문서의 제목(heading)만 훑어 목차 트리를 만든다. 번호 매기기 규칙은
// buildSections()와 동일하지만, 렌더링용 블록 내용은 담지 않는 가벼운 트리다.
export function buildTableOfContents(document: DocumentNode): TocEntry[] {
  const counters = [0, 0, 0, 0, 0, 0];
  const root: TocEntry[] = [];
  const stack: { level: number; children: TocEntry[] }[] = [{ level: 0, children: root }];

  for (const block of document.children) {
    if (block.type !== "heading") continue;

    const level = block.level;
    counters[level - 1]++;
    for (let i = level; i < counters.length; i++) counters[i] = 0;
    const number = `${counters.slice(0, level).join(".")}.`;
    const title = inlineToPlainText(block.children);
    const anchorId = slugifyAnchor(title);

    while (stack.length > 1 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const entry: TocEntry = { level, number, title, anchorId, children: [] };
    stack[stack.length - 1].children.push(entry);
    stack.push({ level, children: entry.children });
  }

  return root;
}
