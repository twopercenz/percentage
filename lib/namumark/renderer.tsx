import type { ReactNode } from "react";
import Link from "next/link";
import { fullTitleHref } from "@/lib/wiki/title";
import { ChevronIcon } from "@/components/ui/icons";
import { TableOfContents } from "@/components/wiki/TableOfContents";
import {
  collectFootnotes,
  hasFootnoteListMacro,
  type BlockNode,
  type CodeBlockNode,
  type ColorBlockNode,
  type DocumentNode,
  type FoldingBlockNode,
  type FootnoteEntry,
  type HeadingNode,
  type HtmlBlockNode,
  type IncludeBlockNode,
  type InlineNode,
  type ListNode,
  type ListStyle,
  type QuoteNode,
  type RedirectNode,
  type ResolvedIncludes,
  type SizeBlockNode,
  type TableNode,
  type WikiBlockNode,
} from "./parser";

export type RenderContext = {
  // 내부 링크 대상 중 실제로 존재하는 문서의 full_title 집합. 파서는 DB에 접근하지
  // 않으므로, 이 정보는 AST 생성 후 별도 조회 단계에서 주입한다(빨간 링크 판정).
  existingTitles?: Set<string>;
  // renderDocument()가 collectFootnotes()로 한 번 계산해서 아래로 넘겨준다.
  // 개별 각주 정의/참조 노드가 자기 번호를 찾는 데 쓴다.
  footnoteNumbers?: Map<InlineNode, number>;
  footnoteEntries?: FootnoteEntry[];
  // renderDocument()가 buildTableOfContents()로 한 번 계산해서 [목차] 매크로에 넘겨준다.
  toc?: TocEntry[];
  // [date]/[age]/[dday]가 기준으로 삼을 "지금". 생략하면 실제 현재 시각을 쓰고,
  // 테스트에서는 결과를 결정적으로 만들기 위해 고정된 값을 넘길 수 있다.
  now?: Date;
  // [pagecount] 전용. DB 조회가 필요해서 파서/렌더러가 직접 구하지 못하므로, 문서에
  // 이 매크로가 실제로 쓰였을 때만(hasPagecountMacro) 호출부가 미리 조회해 넘긴다.
  // 안 넘기면 매크로는 조용히 아무것도 렌더하지 않는다.
  pageCount?: number;
  // [include(...)] 전용. lib/wiki/include.ts의 resolveIncludes()가 미리 조회·파싱해서
  // 넘겨준다. 안 넘기면(또는 target이 이 Map에 없으면) include-block은 원문만 보여준다.
  includedTemplates?: ResolvedIncludes;
  // include-block을 렌더링하며 지금까지 펼쳐 들어온 target 경로. 같은 target을 다시
  // 만나면(순환 include) 더 펼치지 않고 멈춘다 - includedTemplates 자체는 target별로
  // 한 번만 파싱해두는 평평한 Map이라, 이 스택 없이는 자기 자신을 참조하는 틀이
  // 렌더 트리를 무한히 만들어낸다.
  includeStack?: string[];
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
        case "inline-code":
          return node.content;
        case "footnote-def":
        case "footnote-ref":
        case "footnote-list":
        case "macro-toc":
        case "macro-date":
        case "macro-age":
        case "macro-dday":
        case "macro-anchor":
        case "macro-pagecount":
        case "macro-include":
          return "";
        case "macro-ruby":
          return node.text;
        default:
          return inlineToPlainText(node.children);
      }
    })
    .join("");
}

// 색상 유틸리티는 뺀 공통 링크 스타일. 텍스트 색은 사용처에서 정확히 하나만 덧붙인다
// (동일 카테고리 유틸을 문자열 순서로 덮어쓰려 하면 Tailwind 산출 순서에 따라 깨질 수 있다).
const LINK_CLASS = "underline hover:text-[var(--accent-secondary)]";

// {{{#색상 ...}}}의 "색상" 부분(# 뒤 문자열)을 실제 CSS color 값으로 되돌린다.
// hex 3/6자리면 #을 다시 붙이고, 아니면 CSS 색상 키워드(red 등)로 그대로 쓴다.
// url()/expression()/javascript:가 섞인 값은 인젝션 방지를 위해 통째로 버린다.
function safeCssColor(raw: string): string | null {
  if (/url\(|expression\(|javascript:/i.test(raw)) return null;
  return /^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw) ? `#${raw}` : raw;
}

function sizeStyle(delta: number): { fontSize: string } {
  return { fontSize: `${1 + delta * 0.15}em` };
}

function formatDate(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// "YYYY-MM-DD" 형식이 아니거나 실존하지 않는 날짜면 null을 돌려주고, 매크로는
// 원문 인자를 그대로 보여주는 것으로 물러난다(파서/렌더러는 절대 크래시하지 않는다).
function parseIsoDate(dateStr: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  // "2024-02-30" 같은 존재하지 않는 날짜는 Date가 3월로 넘겨버리므로, 넘어간 값과
  // 원래 넣은 값이 다르면 무효로 취급한다.
  if (date.getFullYear() !== Number(y) || date.getMonth() !== Number(m) - 1 || date.getDate() !== Number(d)) {
    return null;
  }
  return date;
}

// [age(YYYY-MM-DD)] - 만 나이(생일이 아직 안 지났으면 한 살 덜 센다).
function computeAge(dateStr: string, now: Date): string | null {
  const birth = parseIsoDate(dateStr);
  if (!birth) return null;
  let age = now.getFullYear() - birth.getFullYear();
  const beforeBirthdayThisYear =
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate());
  if (beforeBirthdayThisYear) age--;
  return `${age}세`;
}

// [dday(YYYY-MM-DD)] - 오늘 대비 남은/지난 날짜 수.
function computeDday(dateStr: string, now: Date): string | null {
  const target = parseIsoDate(dateStr);
  if (!target) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return "D-DAY";
  return diffDays > 0 ? `D-${diffDays}` : `D+${-diffDays}`;
}

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
    case "inline-code":
      return (
        <code key={key} className="rounded bg-[var(--code-background)] px-1.5 py-0.5 font-mono text-sm">
          {node.content}
        </code>
      );
    case "inline-size":
      return (
        <span key={key} style={sizeStyle(node.delta)}>
          {renderInlineNodes(node.children, context)}
        </span>
      );
    case "inline-color": {
      const color = safeCssColor(node.color);
      return (
        <span key={key} style={color ? { color } : undefined}>
          {renderInlineNodes(node.children, context)}
        </span>
      );
    }
    case "footnote-def":
    case "footnote-ref": {
      const number = context.footnoteNumbers?.get(node);
      // 이름을 못 찾은 참조([*모르는이름] 같은)는 조용히 아무것도 보여주지 않는다
      // (파서는 크래시하지 않는다).
      if (!number) return null;
      return (
        <sup key={key}>
          <a id={`fnref-${number}`} href={`#fn-${number}`} className="text-[var(--accent)]">
            [{number}]
          </a>
        </sup>
      );
    }
    case "footnote-list":
      return context.footnoteEntries
        ? renderFootnoteList(context.footnoteEntries, context, `fnlist-${key}`)
        : null;
    case "macro-toc":
      return context.toc ? <TableOfContents key={key} entries={context.toc} /> : null;
    case "macro-date":
      return <span key={key}>{formatDate(context.now ?? new Date())}</span>;
    case "macro-age": {
      const age = computeAge(node.date, context.now ?? new Date());
      // 못 알아듣는 날짜 형식이면 크래시 대신 원문 인자를 그대로 보여준다.
      return <span key={key}>{age ?? node.date}</span>;
    }
    case "macro-dday": {
      const dday = computeDday(node.date, context.now ?? new Date());
      return <span key={key}>{dday ?? node.date}</span>;
    }
    case "macro-ruby":
      return (
        <ruby key={key}>
          {node.text}
          <rt>{node.ruby}</rt>
        </ruby>
      );
    case "macro-anchor":
      return <span key={key} id={slugifyAnchor(node.name)} />;
    case "macro-pagecount":
      return context.pageCount != null ? <span key={key}>{context.pageCount}</span> : null;
    case "macro-include":
      // 문장 중간에 섞여 쓰인 경우(드묾) - 틀 내용은 블록이라 <p> 안에서는 전개하지
      // 않고, 무엇을 가리키는지만 보여준다. 온전한 한 줄짜리 [include(...)]는
      // include-block(renderIncludeBlock)이 실제로 전개한다.
      return (
        <span key={key} className="text-sm text-[var(--muted)]">
          [include({node.target})]
        </span>
      );
  }
}

function renderFootnoteList(entries: FootnoteEntry[], context: RenderContext, key: string): ReactNode {
  if (entries.length === 0) return null;
  return (
    <ol key={key} className="mt-6 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)]">
      {entries.map((entry) => (
        <li key={entry.number} id={`fn-${entry.number}`} className="py-0.5">
          <a href={`#fnref-${entry.number}`} className="mr-1 text-[var(--accent)]">
            ↩
          </a>
          {renderInlineNodes(entry.content, context)}
        </li>
      ))}
    </ol>
  );
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

// #!wiki/#!folding/+N/#색상 블록 안쪽도 제목을 포함한 완전한 위키 문법으로 다시
// 조립한다 - 그냥 renderBlock을 매핑하면 안쪽 heading이 소리 없이 사라진다
// (renderBlock의 heading 케이스는 "buildSections가 이미 소비했다"고 가정하기 때문).
function renderNestedBlocks(blocks: BlockNode[], key: string, context: RenderContext): ReactNode {
  return renderSectionBody(buildSections(blocks), key, context);
}

// 실제 이동은 페이지 컴포넌트가 documents.redirect_target 컬럼을 보고 처리하므로
// 이 블록이 렌더될 일은 거의 없다(옛 리비전 diff/역사 보기처럼 문서 "본문"으로
// 넘겨주기 문법을 볼 때뿐). 그래도 무슨 뜻인지는 알아볼 수 있게 표시한다.
function renderRedirectBlock(block: RedirectNode, key: string): ReactNode {
  return (
    <div key={key} className="my-2 text-sm text-[var(--muted)]">
      #redirect{" "}
      <Link href={fullTitleHref("/w", block.target)} className={`text-[var(--accent)] ${LINK_CLASS}`}>
        {block.target}
      </Link>
    </div>
  );
}

// resolveIncludes()가 미리 조회해둔 틀 내용을 그 자리에 이어붙인다. 순환/미조회/
// 존재하지 않음 어느 경우에도 크래시하지 않고 안내만 보여준다.
function renderIncludeBlock(block: IncludeBlockNode, key: string, context: RenderContext): ReactNode {
  const stack = context.includeStack ?? [];
  if (stack.includes(block.target)) {
    return (
      <div key={key} className="my-2 text-sm text-[var(--danger)]">
        순환 include가 감지되어 멈췄습니다: {block.target}
      </div>
    );
  }

  const resolved = context.includedTemplates?.get(block.target);
  if (resolved === undefined) {
    // 호출부가 includedTemplates를 안 넘겼거나(테스트 등) 아직 조회 전이다.
    return (
      <div key={key} className="my-2 text-sm text-[var(--muted)]">
        [include({block.target})]
      </div>
    );
  }
  if (resolved === null) {
    return (
      <div
        key={key}
        className="my-2 rounded-md border border-dashed border-[var(--border)] px-3 py-2 text-sm text-[var(--danger)]"
      >
        틀을 찾을 수 없습니다: {block.target}
      </div>
    );
  }

  const nestedContext: RenderContext = { ...context, includeStack: [...stack, block.target] };
  return <div key={key} className="my-2">{renderNestedBlocks(resolved.children, key, nestedContext)}</div>;
}

function renderCodeBlock(block: CodeBlockNode, key: string): ReactNode {
  return (
    <div key={key} className="my-4">
      {block.language ? (
        <div className="rounded-t-md border border-b-0 border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-mono text-xs text-[var(--muted)]">
          {block.language}
        </div>
      ) : null}
      <pre
        className={`overflow-x-auto border border-[var(--border)] bg-[var(--code-background)] p-3 font-mono text-sm leading-6 ${block.language ? "rounded-b-md" : "rounded-md"}`}
      >
        <code>{block.content}</code>
      </pre>
    </div>
  );
}

// #!html은 관리자 권한 문서에서만 실제 HTML로 렌더할 예정이지만(§6), 문서별 ACL
// 규칙(P4)이 아직 없어 지금은 누구에게나 항상 이스케이프된 원문으로만 보여준다
// (React가 텍스트 자식은 자동으로 이스케이프하므로 dangerouslySetInnerHTML 없이도 안전하다).
function renderHtmlBlock(block: HtmlBlockNode, key: string): ReactNode {
  return (
    <div key={key} className="my-4">
      <div className="rounded-t-md border border-b-0 border-[var(--border)] bg-[var(--surface)] px-3 py-1 font-mono text-xs text-[var(--muted)]">
        html (관리자 전용 기능 - 현재는 원문만 표시됩니다)
      </div>
      <pre className="overflow-x-auto rounded-b-md border border-[var(--border)] bg-[var(--code-background)] p-3 font-mono text-sm leading-6">
        <code>{block.content}</code>
      </pre>
    </div>
  );
}

function renderWikiBlock(block: WikiBlockNode, key: string, context: RenderContext): ReactNode {
  return (
    <div key={key} style={block.style ?? undefined} className="my-2">
      {renderNestedBlocks(block.children, key, context)}
    </div>
  );
}

function renderFoldingBlock(block: FoldingBlockNode, key: string, context: RenderContext): ReactNode {
  return (
    <details key={key} className="group my-4 rounded-md border border-[var(--border)] p-3">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 font-bold">
        <ChevronIcon className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
        {renderInlineNodes(block.title, context)}
      </summary>
      <div className="mt-2 pl-5">{renderNestedBlocks(block.children, key, context)}</div>
    </details>
  );
}

function renderSizeBlock(block: SizeBlockNode, key: string, context: RenderContext): ReactNode {
  return (
    <div key={key} style={sizeStyle(block.delta)} className="my-2">
      {renderNestedBlocks(block.children, key, context)}
    </div>
  );
}

function renderColorBlock(block: ColorBlockNode, key: string, context: RenderContext): ReactNode {
  const color = safeCssColor(block.color);
  return (
    <div key={key} style={color ? { color } : undefined} className="my-2">
      {renderNestedBlocks(block.children, key, context)}
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
    case "redirect":
      return renderRedirectBlock(block, key);
    case "include-block":
      return renderIncludeBlock(block, key, context);
    case "heading":
      // buildSections()가 heading을 별도로 소비하므로 blocks 배열에는 남지 않는다.
      return null;
    case "code-block":
      return renderCodeBlock(block, key);
    case "html-block":
      return renderHtmlBlock(block, key);
    case "wiki-block":
      return renderWikiBlock(block, key, context);
    case "folding-block":
      return renderFoldingBlock(block, key, context);
    case "size-block":
      return renderSizeBlock(block, key, context);
    case "color-block":
      return renderColorBlock(block, key, context);
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

// GitHub README 렌더링처럼 색을 칠하지 않고 굵기·크기로만 위계를 준다.
// 1~2단계 제목에는 본문 마크다운 렌더러들이 흔히 쓰는 구분선을 아래에 둔다.
const HEADING_SIZE: Record<number, string> = {
  1: "text-2xl",
  2: "text-xl",
  3: "text-lg",
  4: "text-base",
  5: "text-sm",
  6: "text-sm",
};

function renderSection(section: Section, key: string, context: RenderContext): ReactNode {
  const level = Math.min(section.heading.level, 6);
  const HeadingTag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
  const anchorId = slugifyAnchor(inlineToPlainText(section.heading.children));

  return (
    <details key={key} id={anchorId} open className="group my-4">
      <summary
        className={`flex cursor-pointer list-none items-center gap-1.5 ${
          level <= 2 ? "border-b border-[var(--border)] pb-1.5" : ""
        }`}
      >
        <ChevronIcon className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-open:rotate-90" />
        <HeadingTag className={`inline font-bold text-[var(--foreground)] ${HEADING_SIZE[level]}`}>
          <span className="mr-2 font-mono text-sm font-normal text-[var(--muted)]">{section.number}</span>
          {renderInlineNodes(section.heading.children, context)}
        </HeadingTag>
      </summary>
      <div className="mt-1 pl-5">{renderSectionBody(section, key, context)}</div>
    </details>
  );
}

export function renderDocument(document: DocumentNode, context: RenderContext = {}): ReactNode {
  const { numberByNode, entries } = collectFootnotes(document);
  const fullContext: RenderContext = {
    ...context,
    footnoteNumbers: numberByNode,
    footnoteEntries: entries,
    toc: context.toc ?? buildTableOfContents(document),
  };

  const root = buildSections(document.children);
  const body = renderSectionBody(root, "root", fullContext);

  // [각주]를 어디에도 안 썼는데 각주는 있으면 문서 맨 끝에 자동으로 목록을 붙인다.
  const autoFootnoteList =
    entries.length > 0 && !hasFootnoteListMacro(document)
      ? renderFootnoteList(entries, fullContext, "auto-footnotes")
      : null;

  return (
    <>
      {body}
      {autoFootnoteList}
    </>
  );
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
