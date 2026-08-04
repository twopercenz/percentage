import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "../parser";
import { renderDocument } from "../renderer";

function render(source: string, existingTitles?: Set<string>): string {
  return renderToStaticMarkup(renderDocument(parse(source), { existingTitles }));
}

describe("renderDocument", () => {
  it("문단을 <p>로 렌더한다", () => {
    expect(render("안녕하세요")).toBe("<p class=\"my-3 leading-7\">안녕하세요</p>");
  });

  it("굵게/기울임을 <strong>/<em>으로 렌더한다", () => {
    const html = render("'''굵게''' ''기울임''");
    expect(html).toContain("<strong>굵게</strong>");
    expect(html).toContain("<em>기울임</em>");
  });

  it("제목을 접을 수 있는 <details>로 렌더하고 번호를 매긴다", () => {
    const html = render("= 개요 =\n설명\n== 세부 ==\n내용");
    expect(html).toContain("<details");
    expect(html).toContain("<summary");
    expect(html).toContain("<h1");
    expect(html).toContain("<h2");
    expect(html).toContain("1.");
    expect(html).toContain("1.1.");
  });

  it("깨진 입력도 예외 없이 렌더된다", () => {
    expect(() => render("'''안 닫힘\n== 제목 =")).not.toThrow();
  });

  it("존재하는 문서로의 내부 링크는 파란 링크다", () => {
    const html = render("[[대문]]", new Set(["대문"]));
    expect(html).toContain(`href="/w/${encodeURIComponent("대문")}"`);
    expect(html).not.toContain("var(--danger)");
  });

  it("존재하지 않는 문서로의 내부 링크는 빨간 링크다", () => {
    const html = render("[[없는문서]]", new Set());
    expect(html).toContain("var(--danger)");
  });

  it("[[분류:...]]는 본문에 아무것도 렌더하지 않는다", () => {
    expect(render("앞 [[분류:음식]] 뒤")).toBe('<p class="my-3 leading-7">앞  뒤</p>');
  });

  it("외부 링크는 새 탭으로 열리고 rel이 붙는다", () => {
    const html = render("[[https://example.com|예시]]");
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain("noopener");
  });

  it("리스트는 <ul>/<ol>로 렌더되고 중첩된다", () => {
    const html = render("* 상위\n  * 하위");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>상위");
    expect(html).toContain("<li>하위");
  });

  it("순서 있는 리스트 스타일에 따라 마커 종류가 달라진다", () => {
    expect(render("A. 첫째")).toContain("upper-alpha");
    expect(render("a. 첫째")).toContain("lower-alpha");
    expect(render("I. 첫째")).toContain("upper-roman");
    expect(render("1. 첫째")).toContain("list-decimal");
  });

  it("인용은 <blockquote>로, 중첩 인용은 그 안에 중첩된다", () => {
    const html = render("> 바깥\n>> 안쪽");
    expect(html).toContain("<blockquote");
    expect(html.indexOf("<blockquote")).toBeLessThan(
      html.indexOf("<blockquote", html.indexOf("<blockquote") + 1),
    );
  });

  it("----는 <hr>로 렌더된다", () => {
    expect(render("문단\n----\n다음")).toContain("<hr");
  });

  it("표는 <table>/<tr>/<td>로 렌더되고 가로 스크롤 컨테이너로 감싼다", () => {
    const html = render("||A||B||\n||C||D||");
    expect(html).toContain("overflow-x-auto");
    expect(html).toContain("<table");
    expect(html).toContain("<td");
    expect(html).toContain(">A<");
    expect(html).toContain(">D<");
  });

  it("<-2>는 colspan, <|2>는 rowspan 속성으로 렌더된다", () => {
    const html = render("||<-2> 병합||\n||<|2> 세로||일반||");
    expect(html).toContain('colSpan="2"');
    expect(html).toContain('rowSpan="2"');
  });

  it("표 옵션이 없으면 크래시하지 않고 기본 렌더된다", () => {
    expect(() => render("||그냥 셀||")).not.toThrow();
  });
});
