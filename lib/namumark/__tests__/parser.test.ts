import { describe, expect, it } from "vitest";
import { collectCategoryTargets, collectInternalLinkTargets, parse, parseInline } from "../parser";

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
