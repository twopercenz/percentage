import { describe, expect, it } from "vitest";
import { can, type Actor } from "./can";

const doc = { namespace: "문서" };
const anonymous: Actor = { userId: null, permissions: [] };
const member: Actor = { userId: "user-1", permissions: ["member"] };
const admin: Actor = { userId: "user-2", permissions: ["member", "admin"] };

describe("can", () => {
  it("읽기/편집/토론은 비로그인도 허용한다", () => {
    expect(can("read", doc, null)).toBe(true);
    expect(can("edit", doc, anonymous)).toBe(true);
    expect(can("discuss", doc, anonymous)).toBe(true);
  });

  it("삭제/이동은 로그인 사용자만 허용한다", () => {
    expect(can("delete", doc, anonymous)).toBe(false);
    expect(can("move", doc, anonymous)).toBe(false);
    expect(can("delete", doc, member)).toBe(true);
    expect(can("move", doc, member)).toBe(true);
  });

  it("ACL 변경은 관리자만 허용한다", () => {
    expect(can("acl", doc, member)).toBe(false);
    expect(can("acl", doc, admin)).toBe(true);
  });
});
