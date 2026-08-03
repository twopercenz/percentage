import { describe, expect, it } from "vitest";
import { fullTitleHref, parseFullTitle } from "./title";

describe("parseFullTitle", () => {
  it("접두사가 없으면 기본 네임스페이스(문서)로 취급한다", () => {
    expect(parseFullTitle(["테스트문서"])).toEqual({
      namespace: "문서",
      title: "테스트문서",
      fullTitle: "테스트문서",
    });
  });

  it("알려진 네임스페이스 접두사를 인식한다", () => {
    expect(parseFullTitle(["틀:내비게이션"])).toEqual({
      namespace: "틀",
      title: "내비게이션",
      fullTitle: "틀:내비게이션",
    });
  });

  it("알 수 없는 접두사는 기본 네임스페이스의 제목 일부로 취급한다", () => {
    expect(parseFullTitle(["문의:테스트"])).toEqual({
      namespace: "문서",
      title: "문의:테스트",
      fullTitle: "문의:테스트",
    });
  });

  it("여러 세그먼트를 슬래시로 합친다", () => {
    expect(parseFullTitle(["사용자:홍길동", "설정"])).toEqual({
      namespace: "사용자",
      title: "홍길동/설정",
      fullTitle: "사용자:홍길동/설정",
    });
  });
});

describe("fullTitleHref", () => {
  it("전체 제목을 URL 세그먼트로 인코딩한다", () => {
    expect(fullTitleHref("/w", "틀:내비게이션")).toBe(`/w/${encodeURIComponent("틀:내비게이션")}`);
  });

  it("슬래시가 포함된 제목은 세그먼트별로 인코딩한다", () => {
    expect(fullTitleHref("/w", "사용자:홍길동/설정")).toBe(
      `/w/${encodeURIComponent("사용자:홍길동")}/${encodeURIComponent("설정")}`,
    );
  });
});
