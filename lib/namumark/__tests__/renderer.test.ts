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

describe("블록 펜스({{{ }}}) 렌더링", () => {
  it("코드 블록은 <pre><code>로 렌더되고 내용이 서식으로 해석되지 않는다", () => {
    const html = render("{{{\n'''굵게 아님'''\n}}}");
    expect(html).toContain("<pre");
    expect(html).toContain("<code>");
    // React가 따옴표를 HTML 엔티티로 이스케이프하므로 원문 그대로는 아니지만,
    // 실제로 확인하려는 건 "'''가 굵게(<strong>)로 해석되지 않았다"는 것이다.
    expect(html).toContain("굵게 아님");
    expect(html).not.toContain("<strong>");
  });

  it("#!syntax 언어 라벨이 표시된다", () => {
    const html = render("{{{#!syntax python\nprint(1)\n}}}");
    expect(html).toContain("python");
  });

  it("#!wiki style은 안전한 속성만 인라인 style로 반영된다", () => {
    const html = render('{{{#!wiki style="color:red"\n내용\n}}}');
    expect(html).toContain("color:red");
  });

  it("#!folding은 <details>/<summary>로 렌더되고 제목이 보인다", () => {
    const html = render("{{{#!folding 더 보기\n숨겨진 내용\n}}}");
    expect(html).toContain("<details");
    expect(html).toContain("더 보기");
    expect(html).toContain("숨겨진 내용");
  });

  it("#!wiki/#!folding 안쪽 제목도 접을 수 있는 섹션으로 렌더된다(사라지지 않는다)", () => {
    const html = render('{{{#!wiki style="color:red"\n= 안쪽 제목 =\n내용\n}}}');
    expect(html).toContain("안쪽 제목");
    expect(html).toContain("<details");
  });

  it("#!html은 실행되지 않고 이스케이프된 원문으로만 보인다", () => {
    const html = render("{{{#!html\n<script>alert(1)</script>\n}}}");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("깨진 블록 입력도 예외 없이 렌더된다", () => {
    expect(() => render("{{{\n안 닫힘")).not.toThrow();
  });
});

describe("인라인 {{{ }}} 렌더링", () => {
  it("지시어 없는 {{{...}}}는 <code>다", () => {
    const html = render("{{{inline code}}}");
    expect(html).toContain("<code");
    expect(html).toContain("inline code");
  });

  it("{{{+N ...}}}는 font-size가 커진 <span>이다", () => {
    const html = render("{{{+2 크게}}}");
    expect(html).toContain("font-size");
    expect(html).toContain("크게");
  });

  it("{{{#색상 ...}}}는 color가 적용된 <span>이고 hex는 #이 다시 붙는다", () => {
    const html = render("{{{#ff0000 빨강}}}");
    expect(html).toContain("color:#ff0000");
  });

  it("위험한 색상 값(url()등)은 스타일 없이 안전하게 무시된다", () => {
    const html = render("{{{#url(evil.com) 텍스트}}}");
    expect(html).not.toContain("url(evil.com)");
    expect(html).toContain("텍스트");
  });
});

describe("각주 렌더링", () => {
  it("각주 참조는 [번호] 링크로 렌더된다", () => {
    const html = render("문장[* 각주 내용]");
    expect(html).toContain(">[1]<");
    expect(html).toContain('href="#fn-1"');
  });

  it("[각주]를 안 쓰면 목록이 문서 맨 끝에 자동으로 붙는다", () => {
    const html = render("문장[* 각주 내용]");
    expect(html).toContain("각주 내용");
    expect(html).toContain('id="fn-1"');
  });

  it("[각주]를 쓰면 그 자리에 목록이 렌더되고 중복으로 안 붙는다", () => {
    const html = render("문장[* 각주 내용]\n\n[각주]\n\n뒷내용");
    const occurrences = html.split('id="fn-1"').length - 1;
    expect(occurrences).toBe(1);
  });

  it("이름 있는 각주를 다시 참조하면 같은 번호를 가리킨다", () => {
    const html = render("첫[*a 출처] 둘째[*a]");
    expect(html).toContain('href="#fn-1"');
    // 서로 다른 두 <sup> 모두 같은 번호 1을 가리켜야 한다.
    const matches = html.match(/href="#fn-1"/g) ?? [];
    expect(matches.length).toBe(2);
  });

  it("정의되지 않은 이름 참조는 아무것도 렌더하지 않는다(크래시하지 않는다)", () => {
    expect(() => render("[*모르는이름]")).not.toThrow();
    const html = render("[*모르는이름]");
    expect(html).not.toContain("[1]");
  });

  it("각주가 없으면 목록도 렌더되지 않는다", () => {
    const html = render("그냥 문단");
    expect(html).not.toContain("<ol");
  });
});

describe("매크로 렌더링", () => {
  const FIXED_NOW = new Date(2026, 7, 5); // 2026-08-05

  function renderWithContext(source: string, context: Parameters<typeof renderDocument>[1]) {
    return renderToStaticMarkup(renderDocument(parse(source), context));
  }

  it("[br]은 <br>로 렌더된다", () => {
    expect(render("앞[br]뒤")).toContain("<br/>");
  });

  it("[목차]는 그 자리에 목차 상자를 렌더한다", () => {
    const html = render("[목차]\n= 제목 =\n내용");
    expect(html).toContain("목차");
    expect(html).toContain('href="#제목"');
  });

  it("헤딩이 없으면 [목차]는 아무것도 렌더하지 않는다", () => {
    const html = render("[목차]\n그냥 문단");
    expect(html).not.toContain("목차");
  });

  it("[date]는 RenderContext.now 기준 YYYY-MM-DD를 렌더한다", () => {
    const html = renderWithContext("[date]", { now: FIXED_NOW });
    expect(html).toContain("2026-08-05");
  });

  it("[age(...)]는 생일이 지났으면 그 해 나이를 렌더한다", () => {
    const html = renderWithContext("[age(2000-01-01)]", { now: FIXED_NOW });
    expect(html).toContain("26세");
  });

  it("[age(...)]는 생일이 아직 안 지났으면 한 살 덜 렌더한다", () => {
    const html = renderWithContext("[age(2000-12-31)]", { now: FIXED_NOW });
    expect(html).toContain("25세");
  });

  it("[dday(...)]는 미래 날짜에 D-N을 렌더한다", () => {
    const html = renderWithContext("[dday(2026-08-15)]", { now: FIXED_NOW });
    expect(html).toContain("D-10");
  });

  it("[dday(...)]는 과거 날짜에 D+N을 렌더한다", () => {
    const html = renderWithContext("[dday(2026-07-26)]", { now: FIXED_NOW });
    expect(html).toContain("D+10");
  });

  it("[dday(...)]는 오늘 날짜에 D-DAY를 렌더한다", () => {
    const html = renderWithContext("[dday(2026-08-05)]", { now: FIXED_NOW });
    expect(html).toContain("D-DAY");
  });

  it("형식이 잘못된 날짜는 크래시하지 않고 원문을 보여준다", () => {
    expect(() => render("[age(안녕)]")).not.toThrow();
    expect(render("[age(안녕)]")).toContain("안녕");
  });

  it("[ruby(...)]는 <ruby><rt>로 렌더된다", () => {
    const html = render("[ruby(振り仮名, ruby=후리가나)]");
    expect(html).toContain("<ruby>");
    expect(html).toContain("<rt>후리가나</rt>");
    expect(html).toContain("振り仮名");
  });

  it("[anchor(...)]는 id가 붙은 빈 span이다", () => {
    const html = render("[anchor(위치1)]");
    expect(html).toContain('id="위치1"');
  });

  it("[pagecount]는 context.pageCount가 있으면 그 값을 렌더한다", () => {
    const html = renderWithContext("전체 [pagecount]개", { pageCount: 42 });
    expect(html).toContain("42");
  });

  it("[pagecount]는 context.pageCount가 없으면 아무것도 렌더하지 않는다(크래시 안 함)", () => {
    expect(() => render("[pagecount]")).not.toThrow();
  });

  it("알아듣지 못하는 매크로는 원문 그대로 보인다", () => {
    const html = render("[알수없는매크로]");
    expect(html).toContain("[알수없는매크로]");
  });
});

describe("#redirect 렌더링", () => {
  it("#redirect 문서명은 대상 문서로 가는 링크로 렌더된다", () => {
    const html = render("#redirect 대문");
    expect(html).toContain("#redirect");
    expect(html).toContain(`href="/w/${encodeURIComponent("대문")}"`);
    expect(html).toContain(">대문<");
  });
});

describe("include(틀) 렌더링", () => {
  function renderWithContext(source: string, context: Parameters<typeof renderDocument>[1]) {
    return renderToStaticMarkup(renderDocument(parse(source), context));
  }

  it("includedTemplates에 있으면 틀 내용이 그 자리에 전개된다", () => {
    const templateDoc = parse("틀 내용입니다");
    const includedTemplates = new Map([["틀:상단", templateDoc]]);
    const html = renderWithContext("[include(틀:상단)]", { includedTemplates });
    expect(html).toContain("틀 내용입니다");
  });

  it("includedTemplates가 null이면(없음) 안내를 보여준다", () => {
    const includedTemplates = new Map([["틀:없음", null]]);
    const html = renderWithContext("[include(틀:없음)]", { includedTemplates });
    expect(html).toContain("찾을 수 없습니다");
  });

  it("includedTemplates를 아예 안 넘기면 원문 표시로 물러난다(크래시 안 함)", () => {
    expect(() => render("[include(틀:상단)]")).not.toThrow();
    expect(render("[include(틀:상단)]")).toContain("[include(");
  });

  it("자기 자신을 다시 include하는 틀은 순환으로 감지되어 멈춘다", () => {
    const templateDoc = parse("[include(틀:자기자신)]");
    const includedTemplates = new Map([["틀:자기자신", templateDoc]]);
    const html = renderWithContext("[include(틀:자기자신)]", { includedTemplates });
    expect(html).toContain("순환");
  });

  it("문장 중간에 섞인 [include(...)]는 전개하지 않고 표시만 한다", () => {
    const templateDoc = parse("틀 내용입니다");
    const includedTemplates = new Map([["틀:상단", templateDoc]]);
    const html = renderWithContext("앞 [include(틀:상단)] 뒤", { includedTemplates });
    expect(html).not.toContain("틀 내용입니다");
    expect(html).toContain("[include(");
  });
});
