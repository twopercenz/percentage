import { describe, expect, it } from "vitest";
import { tokenizeBlocks } from "../lexer";

describe("tokenizeBlocks", () => {
  it("빈 줄은 blank 토큰이다", () => {
    expect(tokenizeBlocks("")).toEqual([{ type: "blank" }]);
    expect(tokenizeBlocks("   ")).toEqual([{ type: "blank" }]);
  });

  it("일반 줄은 text 토큰이다", () => {
    expect(tokenizeBlocks("안녕하세요")).toEqual([{ type: "text", text: "안녕하세요" }]);
  });

  it("1~6단계 제목을 인식한다", () => {
    expect(tokenizeBlocks("= 개요 =")).toEqual([{ type: "heading", level: 1, text: "개요" }]);
    expect(tokenizeBlocks("====== 세부 ======")).toEqual([
      { type: "heading", level: 6, text: "세부" },
    ]);
  });

  it("앞뒤 = 개수가 다르면 제목으로 인식하지 않는다", () => {
    expect(tokenizeBlocks("== 개요 =")).toEqual([{ type: "text", text: "== 개요 =" }]);
  });

  it("여러 줄을 각각 토큰화한다", () => {
    expect(tokenizeBlocks("= 제목 =\n본문\n\n== 소제목 ==")).toEqual([
      { type: "heading", level: 1, text: "제목" },
      { type: "text", text: "본문" },
      { type: "blank" },
      { type: "heading", level: 2, text: "소제목" },
    ]);
  });

  it("리스트 마커 종류를 구분한다", () => {
    expect(tokenizeBlocks("* 불릿")).toEqual([
      { type: "list-item", indent: 0, style: "unordered", text: "불릿" },
    ]);
    expect(tokenizeBlocks("1. 숫자")).toEqual([
      { type: "list-item", indent: 0, style: "ordered-numeric", text: "숫자" },
    ]);
    expect(tokenizeBlocks("A. 대문자")).toEqual([
      { type: "list-item", indent: 0, style: "ordered-upper-alpha", text: "대문자" },
    ]);
    expect(tokenizeBlocks("a. 소문자")).toEqual([
      { type: "list-item", indent: 0, style: "ordered-lower-alpha", text: "소문자" },
    ]);
    expect(tokenizeBlocks("I. 로마")).toEqual([
      { type: "list-item", indent: 0, style: "ordered-roman", text: "로마" },
    ]);
  });

  it("리스트 들여쓰기 칸 수를 센다", () => {
    expect(tokenizeBlocks("  * 중첩")).toEqual([
      { type: "list-item", indent: 2, style: "unordered", text: "중첩" },
    ]);
  });

  it("> 로 시작하는 줄은 인용이고 depth는 > 개수다", () => {
    expect(tokenizeBlocks("> 인용")).toEqual([{ type: "quote", depth: 1, text: "인용" }]);
    expect(tokenizeBlocks(">> 중첩 인용")).toEqual([
      { type: "quote", depth: 2, text: "중첩 인용" },
    ]);
  });

  it("대시 4개 이상만 있는 줄은 수평선이다", () => {
    expect(tokenizeBlocks("----")).toEqual([{ type: "hr" }]);
    expect(tokenizeBlocks("------")).toEqual([{ type: "hr" }]);
  });

  it("대시가 섞인 줄은 수평선이 아니라 일반 텍스트다", () => {
    expect(tokenizeBlocks("--취소선--")).toEqual([{ type: "text", text: "--취소선--" }]);
    expect(tokenizeBlocks("---")).toEqual([{ type: "text", text: "---" }]);
  });

  it("||로 감싼 줄은 표 행이고 ||로 셀을 나눈다", () => {
    expect(tokenizeBlocks("||A||B||")).toEqual([{ type: "table-row", cells: ["A", "B"] }]);
  });

  it("표 행이 아닌 || 사용은 텍스트로 남는다", () => {
    expect(tokenizeBlocks("||")).toEqual([{ type: "text", text: "||" }]);
  });
});
