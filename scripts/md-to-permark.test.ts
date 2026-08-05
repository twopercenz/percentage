import { describe, expect, it } from "vitest";
import { convertInline, convertMarkdownToPerMark } from "./md-to-permark";

describe("convertInline", () => {
  it("굵게/기울임/취소선을 변환한다", () => {
    expect(convertInline("**굵게**")).toBe("'''굵게'''");
    expect(convertInline("__굵게__")).toBe("'''굵게'''");
    expect(convertInline("*기울임*")).toBe("''기울임''");
    expect(convertInline("~~취소선~~")).toBe("~~취소선~~");
  });

  it("snake_case 식별자는 기울임으로 오인하지 않는다", () => {
    expect(convertInline("my_var_name 은 변수다")).toBe("my_var_name 은 변수다");
  });

  it("외부 링크와 앵커 링크를 변환한다", () => {
    expect(convertInline("[예시](https://example.com)")).toBe("[[https://example.com|예시]]");
    expect(convertInline("[개요](#개요)")).toBe("[[#개요|개요]]");
  });

  it("상대 경로 링크는 .md 확장자를 떼고 내부 링크로 바꾼다", () => {
    expect(convertInline("[다른 문서](other-doc.md)")).toBe("[[other-doc|다른 문서]]");
  });

  it("이미지를 파일 링크로 변환한다", () => {
    expect(convertInline("![대체텍스트](image.png)")).toBe("[[파일:image.png|alt=대체텍스트]]");
    expect(convertInline("![](image.png)")).toBe("[[파일:image.png]]");
  });

  it("인라인 코드는 코드 블록 구문으로 감싸고 안쪽은 서식 변환에서 보호한다", () => {
    expect(convertInline("`a*b*c`는 코드다")).toBe("{{{a*b*c}}}는 코드다");
  });
});

describe("convertMarkdownToPerMark", () => {
  it("ATX 제목을 =로 감싼 제목으로 바꾼다", () => {
    expect(convertMarkdownToPerMark("# 제목\n## 소제목")).toBe("= 제목 =\n== 소제목 ==");
  });

  it("수평선(---, ***, ___)을 ----로 통일한다", () => {
    expect(convertMarkdownToPerMark("---")).toBe("----");
    expect(convertMarkdownToPerMark("***")).toBe("----");
    expect(convertMarkdownToPerMark("___")).toBe("----");
  });

  it("비순서/순서 리스트를 변환하고 들여쓰기를 보존한다", () => {
    const input = "- 상위\n  - 하위\n1. 첫째\n2. 둘째";
    expect(convertMarkdownToPerMark(input)).toBe("* 상위\n  * 하위\n1. 첫째\n2. 둘째");
  });

  it("체크박스 리스트를 기호로 표시한다", () => {
    expect(convertMarkdownToPerMark("- [ ] 할일\n- [x] 완료")).toBe("* ☐ 할일\n* ☑ 완료");
  });

  it("인용문의 > 개수를 그대로 depth로 유지한다", () => {
    expect(convertMarkdownToPerMark("> 인용\n>> 중첩 인용")).toBe("> 인용\n>> 중첩 인용");
  });

  it("펜스 코드 블록을 {{{#!syntax}}}로 바꾸고 내부는 손대지 않는다", () => {
    const input = "```ts\nconst a = **not bold**;\n```";
    expect(convertMarkdownToPerMark(input)).toBe(
      "{{{#!syntax ts\nconst a = **not bold**;\n}}}",
    );
  });

  it("언어 표기 없는 펜스는 {{{}}}로 바꾼다", () => {
    expect(convertMarkdownToPerMark("```\ncode\n```")).toBe("{{{\ncode\n}}}");
  });

  it("GFM 표를 || 형태로 바꾼다", () => {
    const input = ["| 이름 | 값 |", "| --- | --- |", "| a | 1 |", "| b | 2 |"].join("\n");
    expect(convertMarkdownToPerMark(input)).toBe(
      ["|| 이름 || 값 ||", "|| a || 1 ||", "|| b || 2 ||"].join("\n"),
    );
  });

  it("일반 문단은 인라인 변환만 적용한다", () => {
    expect(convertMarkdownToPerMark("그냥 **문단**입니다.")).toBe("그냥 '''문단'''입니다.");
  });
});
