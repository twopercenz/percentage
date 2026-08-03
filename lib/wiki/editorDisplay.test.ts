import { describe, expect, it } from "vitest";
import { editorDisplayName } from "./editorDisplay";

describe("editorDisplayName", () => {
  it("로그인 사용자는 username을 표시한다", () => {
    const usernameById = new Map([["user-1", "길동이"]]);
    expect(
      editorDisplayName({ editor_user_id: "user-1", editor_ip_display: null }, usernameById),
    ).toBe("길동이");
  });

  it("비로그인 사용자는 마스킹된 IP를 표시한다", () => {
    expect(
      editorDisplayName(
        { editor_user_id: null, editor_ip_display: "211.245.***.***" },
        new Map(),
      ),
    ).toBe("211.245.***.***");
  });

  it("username을 찾지 못하면 대체 문구를 표시한다", () => {
    expect(
      editorDisplayName({ editor_user_id: "missing", editor_ip_display: null }, new Map()),
    ).toBe("(알 수 없는 사용자)");
  });
});
