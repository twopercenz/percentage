import { describe, expect, it } from "vitest";
import {
  collectCategoryTargets,
  collectFootnotes,
  collectIncludeDirectives,
  collectInternalLinkTargets,
  extractRedirectTarget,
  hasFootnoteListMacro,
  hasPagecountMacro,
  hasTocMacro,
  parse,
  parseInline,
} from "../parser";

describe("parseInline", () => {
  it("일반 텍스트는 text 노드 하나다", () => {
    expect(parseInline("안녕")).toEqual([{ type: "text", value: "안녕" }]);
  });

  it("굵게/기울임/밑줄/취소선/위첨자/아래첨자를 인식한다", () => {
    expect(parseInline("'''굵게'''")).toEqual([
      { type: "bold", children: [{ type: "text", value: "굵게" }] },
    ]);
    expect(parseInline("''기울임''")).toEqual([
      { type: "italic", children: [{ type: "text", value: "기울임" }] },
    ]);
    expect(parseInline("__밑줄__")).toEqual([
      { type: "underline", children: [{ type: "text", value: "밑줄" }] },
    ]);
    expect(parseInline("~~취소선~~")).toEqual([
      { type: "strikethrough", children: [{ type: "text", value: "취소선" }] },
    ]);
    expect(parseInline("--취소선--")).toEqual([
      { type: "strikethrough", children: [{ type: "text", value: "취소선" }] },
    ]);
    expect(parseInline("^^위첨자^^")).toEqual([
      { type: "superscript", children: [{ type: "text", value: "위첨자" }] },
    ]);
    expect(parseInline(",,아래첨자,,")).toEqual([
      { type: "subscript", children: [{ type: "text", value: "아래첨자" }] },
    ]);
  });

  it("서식은 중첩될 수 있다", () => {
    expect(parseInline("'''굵고 ''기울인'' 글자'''")).toEqual([
      {
        type: "bold",
        children: [
          { type: "text", value: "굵고 " },
          { type: "italic", children: [{ type: "text", value: "기울인" }] },
          { type: "text", value: " 글자" },
        ],
      },
    ]);
  });

  it("서식 앞뒤 일반 텍스트를 함께 반환한다", () => {
    expect(parseInline("앞 '''굵게''' 뒤")).toEqual([
      { type: "text", value: "앞 " },
      { type: "bold", children: [{ type: "text", value: "굵게" }] },
      { type: "text", value: " 뒤" },
    ]);
  });

  it("닫히지 않은 마커는 원문 그대로 남긴다", () => {
    expect(parseInline("'''안녕")).toEqual([
      { type: "text", value: "'''" },
      { type: "text", value: "안녕" },
    ]);
  });

  it("망가진 입력도 예외 없이 배열을 반환한다", () => {
    expect(() => parseInline("'''a __b'''c__ ,,d^^e")).not.toThrow();
    expect(Array.isArray(parseInline("'''a __b'''c__ ,,d^^e"))).toBe(true);
  });

  it("[[문서]]는 표시 텍스트 없는 내부 링크다", () => {
    expect(parseInline("[[대문]]")).toEqual([
      { type: "internal-link", target: "대문", children: null },
    ]);
  });

  it("[[문서|표시]]는 표시 텍스트가 있는 내부 링크다", () => {
    expect(parseInline("[[대문|메인]]")).toEqual([
      {
        type: "internal-link",
        target: "대문",
        children: [{ type: "text", value: "메인" }],
      },
    ]);
  });

  it("[[#앵커]]는 앵커 링크다", () => {
    expect(parseInline("[[#개요]]")).toEqual([
      { type: "anchor-link", anchor: "개요", children: null },
    ]);
  });

  it("[[https://...]]는 외부 링크다", () => {
    expect(parseInline("[[https://example.com|예시]]")).toEqual([
      {
        type: "external-link",
        url: "https://example.com",
        children: [{ type: "text", value: "예시" }],
      },
    ]);
  });

  it("[[파일:...]]는 옵션을 key=value로 파싱한다", () => {
    expect(parseInline("[[파일:sample.png|width=300|align=center]]")).toEqual([
      {
        type: "file-link",
        target: "파일:sample.png",
        options: { width: "300", align: "center" },
      },
    ]);
  });

  it("[[분류:...]]는 category-link다(표시 텍스트 없음)", () => {
    expect(parseInline("[[분류:음식]]")).toEqual([
      { type: "category-link", target: "분류:음식" },
    ]);
  });

  it("링크 표시 텍스트 안의 서식도 파싱된다", () => {
    expect(parseInline("[[대문|'''굵게''']]")).toEqual([
      {
        type: "internal-link",
        target: "대문",
        children: [{ type: "bold", children: [{ type: "text", value: "굵게" }] }],
      },
    ]);
  });

  it("닫는 ]]가 없으면 링크로 취급하지 않는다", () => {
    expect(parseInline("[[대문")).toEqual([{ type: "text", value: "[[대문" }]);
  });

  it("한 줄 안에서 닫히는 {{{내용}}}은 지시어가 없으면 inline-code다", () => {
    expect(parseInline("{{{const x = 1}}}")).toEqual([
      { type: "inline-code", content: "const x = 1" },
    ]);
  });

  it("{{{+N 텍스트}}}는 inline-size이고 안쪽을 다시 파싱한다", () => {
    expect(parseInline("{{{+2 '''큰 굵은 글씨'''}}}")).toEqual([
      {
        type: "inline-size",
        delta: 2,
        children: [{ type: "bold", children: [{ type: "text", value: "큰 굵은 글씨" }] }],
      },
    ]);
  });

  it("{{{-N 텍스트}}}는 delta가 음수인 inline-size다", () => {
    expect(parseInline("{{{-1 작게}}}")).toEqual([
      { type: "inline-size", delta: -1, children: [{ type: "text", value: "작게" }] },
    ]);
  });

  it("{{{#색상 텍스트}}}는 inline-color다", () => {
    expect(parseInline("{{{#ff0000 빨간 글씨}}}")).toEqual([
      { type: "inline-color", color: "ff0000", children: [{ type: "text", value: "빨간 글씨" }] },
    ]);
  });

  it("닫는 }}}가 없으면 인라인 서식으로 취급하지 않는다", () => {
    expect(parseInline("{{{안 닫힘")).toEqual([{ type: "text", value: "{{{안 닫힘" }]);
  });
});

describe("collectInternalLinkTargets", () => {
  it("내부 링크와 파일 링크의 target을 모으고, 분류 링크는 제외한다", () => {
    const doc = parse("[[대문]]과 [[분류:음식]], [[파일:a.png]], [[#앵커]], [[https://x.com]]");
    expect(collectInternalLinkTargets(doc).sort()).toEqual(["대문", "파일:a.png"].sort());
  });

  it("리스트 안 링크도 수집한다", () => {
    const doc = parse("* [[문서A]]\n* [[문서B]]");
    expect(collectInternalLinkTargets(doc).sort()).toEqual(["문서A", "문서B"]);
  });
});

describe("collectCategoryTargets", () => {
  it("분류 링크만 모으고 중복을 제거한다", () => {
    const doc = parse("[[분류:음식]] [[대문]] [[분류:한국]] [[분류:음식]]");
    expect(collectCategoryTargets(doc).sort()).toEqual(["분류:음식", "분류:한국"]);
  });

  it("분류 링크가 없으면 빈 배열이다", () => {
    expect(collectCategoryTargets(parse("그냥 문단"))).toEqual([]);
  });
});

describe("parse", () => {
  it("빈 줄로 구분된 문단을 만든다", () => {
    const doc = parse("첫 문단\n\n둘째 문단");
    expect(doc).toEqual({
      type: "document",
      children: [
        { type: "paragraph", children: [{ type: "text", value: "첫 문단" }] },
        { type: "paragraph", children: [{ type: "text", value: "둘째 문단" }] },
      ],
    });
  });

  it("문단 안 여러 줄은 linebreak로 이어진다", () => {
    const doc = parse("첫 줄\n둘째 줄");
    expect(doc).toEqual({
      type: "document",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "첫 줄" },
            { type: "linebreak" },
            { type: "text", value: "둘째 줄" },
          ],
        },
      ],
    });
  });

  it("제목과 본문을 함께 파싱한다", () => {
    const doc = parse("= 개요 =\n설명입니다.");
    expect(doc).toEqual({
      type: "document",
      children: [
        { type: "heading", level: 1, children: [{ type: "text", value: "개요" }] },
        { type: "paragraph", children: [{ type: "text", value: "설명입니다." }] },
      ],
    });
  });

  it("잘못된 입력에서도 크래시하지 않는다", () => {
    expect(() => parse("'''닫히지 않음\n== 개요 =\n{{{ 코드")).not.toThrow();
  });

  it("연속된 리스트 항목을 하나의 리스트로 묶는다", () => {
    const doc = parse("* 첫째\n* 둘째");
    expect(doc).toEqual({
      type: "document",
      children: [
        {
          type: "list",
          style: "unordered",
          items: [
            { type: "list-item", children: [{ type: "text", value: "첫째" }], sublist: null },
            { type: "list-item", children: [{ type: "text", value: "둘째" }], sublist: null },
          ],
        },
      ],
    });
  });

  it("들여쓰기가 깊어지면 하위 리스트로 중첩한다", () => {
    const doc = parse("* 상위\n  * 하위");
    expect(doc).toEqual({
      type: "document",
      children: [
        {
          type: "list",
          style: "unordered",
          items: [
            {
              type: "list-item",
              children: [{ type: "text", value: "상위" }],
              sublist: {
                type: "list",
                style: "unordered",
                items: [
                  {
                    type: "list-item",
                    children: [{ type: "text", value: "하위" }],
                    sublist: null,
                  },
                ],
              },
            },
          ],
        },
      ],
    });
  });

  it("같은 들여쓰기라도 마커 종류가 바뀌면 별개 리스트다", () => {
    const doc = parse("* 불릿\n1. 숫자");
    expect(doc.children).toEqual([
      {
        type: "list",
        style: "unordered",
        items: [{ type: "list-item", children: [{ type: "text", value: "불릿" }], sublist: null }],
      },
      {
        type: "list",
        style: "ordered-numeric",
        items: [{ type: "list-item", children: [{ type: "text", value: "숫자" }], sublist: null }],
      },
    ]);
  });

  it("리스트 뒤 일반 문단은 별개 블록이다", () => {
    const doc = parse("* 항목\n\n일반 문단");
    expect(doc.children).toEqual([
      {
        type: "list",
        style: "unordered",
        items: [{ type: "list-item", children: [{ type: "text", value: "항목" }], sublist: null }],
      },
      { type: "paragraph", children: [{ type: "text", value: "일반 문단" }] },
    ]);
  });

  it("연속된 인용 줄은 linebreak로 이어진 하나의 인용이다", () => {
    const doc = parse("> 첫 줄\n> 둘째 줄");
    expect(doc.children).toEqual([
      {
        type: "quote",
        children: [
          { type: "text", value: "첫 줄" },
          { type: "linebreak" },
          { type: "text", value: "둘째 줄" },
        ],
        nested: null,
      },
    ]);
  });

  it("더 깊은 > 는 중첩 인용이 된다", () => {
    const doc = parse("> 바깥\n>> 안쪽");
    expect(doc.children).toEqual([
      {
        type: "quote",
        children: [{ type: "text", value: "바깥" }],
        nested: {
          type: "quote",
          children: [{ type: "text", value: "안쪽" }],
          nested: null,
        },
      },
    ]);
  });

  it("----는 hr 블록이다", () => {
    const doc = parse("문단\n----\n다음 문단");
    expect(doc.children).toEqual([
      { type: "paragraph", children: [{ type: "text", value: "문단" }] },
      { type: "hr" },
      { type: "paragraph", children: [{ type: "text", value: "다음 문단" }] },
    ]);
  });

  it("표 행들을 하나의 table 블록으로 묶는다", () => {
    const doc = parse("||A||B||\n||C||D||");
    expect(doc.children).toEqual([
      {
        type: "table",
        align: null,
        width: null,
        bgcolor: null,
        rows: [
          {
            type: "table-row",
            cells: [
              {
                type: "table-cell",
                children: [{ type: "text", value: "A" }],
                colspan: 1,
                rowspan: 1,
                bgcolor: null,
                width: null,
              },
              {
                type: "table-cell",
                children: [{ type: "text", value: "B" }],
                colspan: 1,
                rowspan: 1,
                bgcolor: null,
                width: null,
              },
            ],
          },
          {
            type: "table-row",
            cells: [
              {
                type: "table-cell",
                children: [{ type: "text", value: "C" }],
                colspan: 1,
                rowspan: 1,
                bgcolor: null,
                width: null,
              },
              {
                type: "table-cell",
                children: [{ type: "text", value: "D" }],
                colspan: 1,
                rowspan: 1,
                bgcolor: null,
                width: null,
              },
            ],
          },
        ],
      },
    ]);
  });

  it("<table ...> 옵션은 첫 행 첫 셀에서만 표 전체 옵션으로 읽힌다", () => {
    const doc = parse("||<table align=center><table width=50%> 헤더||");
    const table = doc.children[0];
    if (table.type !== "table") throw new Error("table 블록이 아님");
    expect(table.align).toBe("center");
    expect(table.width).toBe("50%");
    expect(table.rows[0].cells[0].children).toEqual([{ type: "text", value: "헤더" }]);
  });

  it("table 접두사 없는 <width=...>는 표가 아니라 셀 옵션이다", () => {
    const doc = parse("||<width=30%> 셀||");
    const table = doc.children[0];
    if (table.type !== "table") throw new Error("table 블록이 아님");
    expect(table.width).toBeNull();
    expect(table.rows[0].cells[0].width).toBe("30%");
  });

  it("<-N>은 colspan, <|N>은 rowspan, bgcolor=는 셀 배경색이다", () => {
    const doc = parse("||<-2><bgcolor=#fff> 병합 셀||\n||<|2> 세로병합||일반||");
    const table = doc.children[0];
    if (table.type !== "table") throw new Error("table 블록이 아님");
    expect(table.rows[0].cells[0]).toMatchObject({ colspan: 2, bgcolor: "#fff" });
    expect(table.rows[1].cells[0]).toMatchObject({ rowspan: 2 });
  });

  it("알 수 없는 태그는 무시하고 크래시하지 않는다", () => {
    expect(() => parse("||<align=center><unknown> 셀||")).not.toThrow();
  });
});

describe("블록 펜스({{{ }}})", () => {
  it("빈 지시어는 code-block(언어 없음)이다", () => {
    const doc = parse("{{{\nplain code\nline2\n}}}");
    expect(doc.children).toEqual([
      { type: "code-block", language: null, content: "plain code\nline2" },
    ]);
  });

  it("#!syntax는 언어가 지정된 code-block이다", () => {
    const doc = parse("{{{#!syntax python\nprint(1)\n}}}");
    expect(doc.children).toEqual([
      { type: "code-block", language: "python", content: "print(1)" },
    ]);
  });

  it("코드 블록 안의 내용은 위키 문법으로 재해석되지 않는다", () => {
    const doc = parse("{{{\n'''굵게 아님'''\n}}}");
    expect(doc.children).toEqual([
      { type: "code-block", language: null, content: "'''굵게 아님'''" },
    ]);
  });

  it("#!wiki style은 안전한 속성만 골라 style 객체로 만든다", () => {
    const doc = parse(
      '{{{#!wiki style="color:red;background-color:blue;behavior:url(evil.htc)"\n내용\n}}}',
    );
    expect(doc.children).toEqual([
      {
        type: "wiki-block",
        style: { color: "red", backgroundColor: "blue" },
        children: [{ type: "paragraph", children: [{ type: "text", value: "내용" }] }],
      },
    ]);
  });

  it("#!wiki 안쪽은 완전한 위키 문법으로 재귀 파싱된다", () => {
    const doc = parse('{{{#!wiki style="color:red"\n= 안쪽 제목 =\n}}}');
    const block = doc.children[0];
    if (block.type !== "wiki-block") throw new Error("wiki-block이 아님");
    expect(block.children).toEqual([
      { type: "heading", level: 1, children: [{ type: "text", value: "안쪽 제목" }] },
    ]);
  });

  it("#!folding은 제목과 재귀 파싱된 내용을 갖는다", () => {
    const doc = parse("{{{#!folding 더 보기\n숨겨진 내용\n}}}");
    expect(doc.children).toEqual([
      {
        type: "folding-block",
        title: [{ type: "text", value: "더 보기" }],
        children: [{ type: "paragraph", children: [{ type: "text", value: "숨겨진 내용" }] }],
      },
    ]);
  });

  it("+N/-N 여러 줄 블록은 size-block이다", () => {
    const doc = parse("{{{+2\n큰 글씨\n}}}");
    expect(doc.children).toEqual([
      {
        type: "size-block",
        delta: 2,
        children: [{ type: "paragraph", children: [{ type: "text", value: "큰 글씨" }] }],
      },
    ]);
  });

  it("#색상 여러 줄 블록은 color-block이다", () => {
    const doc = parse("{{{#ff0000\n빨간 글씨\n}}}");
    expect(doc.children).toEqual([
      {
        type: "color-block",
        color: "ff0000",
        children: [{ type: "paragraph", children: [{ type: "text", value: "빨간 글씨" }] }],
      },
    ]);
  });

  it("#!html은 렌더 시 이스케이프할 수 있도록 원문을 그대로 보존한다", () => {
    const doc = parse("{{{#!html\n<script>alert(1)</script>\n}}}");
    expect(doc.children).toEqual([
      { type: "html-block", content: "<script>alert(1)</script>" },
    ]);
  });

  it("알 수 없는 지시어는 code-block으로 안전하게 처리된다", () => {
    const doc = parse("{{{#!unknown-thing\n내용\n}}}");
    expect(doc.children).toEqual([
      { type: "code-block", language: null, content: "내용" },
    ]);
  });

  it("닫는 }}}가 없어도 크래시하지 않는다", () => {
    expect(() => parse("{{{\n안 닫힘")).not.toThrow();
  });

  it("과도한 중첩은 무한 재귀 없이 안전하게 처리된다", () => {
    const nested = "{{{#!wiki style=\"color:red\"\n".repeat(30) + "내용" + "\n}}}".repeat(30);
    expect(() => parse(nested)).not.toThrow();
  });
});

describe("각주", () => {
  it("[* 내용]은 이름 없는 footnote-def다", () => {
    expect(parseInline("문장[* 각주 내용]")).toEqual([
      { type: "text", value: "문장" },
      { type: "footnote-def", name: null, content: [{ type: "text", value: "각주 내용" }] },
    ]);
  });

  it("[*이름 내용]은 이름 있는 footnote-def다", () => {
    expect(parseInline("[*출처 어떤 책, 2024]")).toEqual([
      { type: "footnote-def", name: "출처", content: [{ type: "text", value: "어떤 책, 2024" }] },
    ]);
  });

  it("[*이름]은(공백 없이) 같은 이름을 가리키는 footnote-ref다", () => {
    expect(parseInline("[*출처]")).toEqual([{ type: "footnote-ref", name: "출처" }]);
  });

  it("[각주]는 footnote-list다", () => {
    expect(parseInline("[각주]")).toEqual([{ type: "footnote-list" }]);
  });

  it("collectFootnotes는 등장 순서대로 번호를 매기고 이름 참조를 연결한다", () => {
    const doc = parse("첫[*a 하나] 둘[* 둘] 다시[*a]");
    const { numberByNode, entries } = collectFootnotes(doc);
    expect(entries).toEqual([
      { number: 1, content: [{ type: "text", value: "하나" }] },
      { number: 2, content: [{ type: "text", value: "둘" }] },
    ]);

    const paragraph = doc.children[0];
    if (paragraph.type !== "paragraph") throw new Error("paragraph 아님");
    const [, def1, , def2, , ref1] = paragraph.children;
    expect(numberByNode.get(def1)).toBe(1);
    expect(numberByNode.get(def2)).toBe(2);
    expect(numberByNode.get(ref1)).toBe(1);
  });

  it("정의되지 않은 이름을 참조하면 번호가 없다(크래시하지 않는다)", () => {
    const doc = parse("[*모르는이름]");
    const { numberByNode } = collectFootnotes(doc);
    const paragraph = doc.children[0];
    if (paragraph.type !== "paragraph") throw new Error("paragraph 아님");
    expect(numberByNode.has(paragraph.children[0])).toBe(false);
  });

  it("hasFootnoteListMacro는 [각주] 사용 여부를 판정한다", () => {
    expect(hasFootnoteListMacro(parse("문장[* 각주]"))).toBe(false);
    expect(hasFootnoteListMacro(parse("문장[* 각주]\n\n[각주]"))).toBe(true);
  });
});

describe("매크로", () => {
  it("[br]은 linebreak 노드다", () => {
    expect(parseInline("[br]")).toEqual([{ type: "linebreak" }]);
  });

  it("[목차]와 [tableofcontents]는 macro-toc다", () => {
    expect(parseInline("[목차]")).toEqual([{ type: "macro-toc" }]);
    expect(parseInline("[tableofcontents]")).toEqual([{ type: "macro-toc" }]);
  });

  it("[date]는 macro-date다", () => {
    expect(parseInline("[date]")).toEqual([{ type: "macro-date" }]);
  });

  it("[pagecount]는 macro-pagecount다", () => {
    expect(parseInline("[pagecount]")).toEqual([{ type: "macro-pagecount" }]);
  });

  it("[age(YYYY-MM-DD)]는 macro-age다", () => {
    expect(parseInline("[age(2000-01-01)]")).toEqual([
      { type: "macro-age", date: "2000-01-01" },
    ]);
  });

  it("[dday(YYYY-MM-DD)]는 macro-dday다", () => {
    expect(parseInline("[dday(2030-12-31)]")).toEqual([
      { type: "macro-dday", date: "2030-12-31" },
    ]);
  });

  it("[anchor(이름)]은 macro-anchor다", () => {
    expect(parseInline("[anchor(위치1)]")).toEqual([{ type: "macro-anchor", name: "위치1" }]);
  });

  it("[ruby(글자, ruby=루비)]는 macro-ruby다", () => {
    expect(parseInline("[ruby(振り仮名, ruby=후리가나)]")).toEqual([
      { type: "macro-ruby", text: "振り仮名", ruby: "후리가나" },
    ]);
  });

  it("ruby= 인자가 없는 [ruby(...)]는 매크로로 인식하지 않고 원문을 남긴다", () => {
    expect(parseInline("[ruby(글자)]")).toEqual([{ type: "text", value: "[ruby(글자)]" }]);
  });

  it("알아듣지 못하는 대괄호 매크로는 원문 그대로 남는다(크래시하지 않는다)", () => {
    expect(parseInline("[알수없는매크로]")).toEqual([
      { type: "text", value: "[알수없는매크로]" },
    ]);
  });

  it("hasTocMacro는 [목차] 사용 여부를 판정한다", () => {
    expect(hasTocMacro(parse("그냥 문단"))).toBe(false);
    expect(hasTocMacro(parse("[목차]\n= 제목 ="))).toBe(true);
  });

  it("hasPagecountMacro는 [pagecount] 사용 여부를 판정한다", () => {
    expect(hasPagecountMacro(parse("그냥 문단"))).toBe(false);
    expect(hasPagecountMacro(parse("총 [pagecount]개 문서"))).toBe(true);
  });
});

describe("#redirect", () => {
  it("extractRedirectTarget은 첫 줄이 #redirect면 대상을 돌려준다", () => {
    expect(extractRedirectTarget("#redirect 대문")).toBe("대문");
    expect(extractRedirectTarget("#redirect 분류:음식\n둘째 줄")).toBe("분류:음식");
  });

  it("extractRedirectTarget은 첫 줄이 아니면 무시한다", () => {
    expect(extractRedirectTarget("그냥 문단\n#redirect 대문")).toBeNull();
  });

  it("extractRedirectTarget은 #redirect가 없으면 null이다", () => {
    expect(extractRedirectTarget("그냥 문단")).toBeNull();
  });

  it("parse()는 #redirect 첫 줄을 redirect 노드로 만든다", () => {
    const doc = parse("#redirect 대문");
    expect(doc.children[0]).toEqual({ type: "redirect", target: "대문" });
  });

  it("#redirect 아래 남은 내용도 이어서 파싱된다", () => {
    const doc = parse("#redirect 대문\n\n남은 문단");
    expect(doc.children).toEqual([
      { type: "redirect", target: "대문" },
      { type: "paragraph", children: [{ type: "text", value: "남은 문단" }] },
    ]);
  });
});

describe("include(틀)", () => {
  it("줄 전체가 [include(틀:이름)]이면 include-block이다", () => {
    const doc = parse("[include(틀:상단)]");
    expect(doc.children).toEqual([{ type: "include-block", target: "틀:상단", params: {} }]);
  });

  it("인자를 key=value로 파싱한다", () => {
    const doc = parse("[include(틀:상자, 제목=안녕, 색=파랑)]");
    expect(doc.children).toEqual([
      { type: "include-block", target: "틀:상자", params: { 제목: "안녕", 색: "파랑" } },
    ]);
  });

  it("앞뒤에 다른 텍스트가 있으면 include-block이 아니라 문단 안 인라인 노드다", () => {
    const doc = parse("앞 [include(틀:상단)] 뒤");
    expect(doc.children[0]).toEqual({
      type: "paragraph",
      children: [
        { type: "text", value: "앞 " },
        { type: "macro-include", target: "틀:상단", params: {} },
        { type: "text", value: " 뒤" },
      ],
    });
  });

  it("대상이 비어 있으면 매크로로 인식하지 않고 원문을 남긴다", () => {
    expect(parseInline("[include()]")).toEqual([{ type: "text", value: "[include()]" }]);
  });

  it("collectIncludeDirectives는 최상위 include-block들을 모은다", () => {
    const doc = parse("[include(틀:하나)]\n\n[include(틀:둘, a=1)]");
    expect(collectIncludeDirectives(doc)).toEqual([
      { target: "틀:하나", params: {} },
      { target: "틀:둘", params: { a: "1" } },
    ]);
  });

  it("collectIncludeDirectives는 #!wiki 블록 안에 중첩된 include도 찾는다", () => {
    const doc = parse('{{{#!wiki style="color:red"\n[include(틀:중첩)]\n}}}');
    expect(collectIncludeDirectives(doc)).toEqual([{ target: "틀:중첩", params: {} }]);
  });

  it("include-block이 없으면 빈 배열이다", () => {
    expect(collectIncludeDirectives(parse("그냥 문단"))).toEqual([]);
  });
});
