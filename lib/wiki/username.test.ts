import { describe, expect, it } from "vitest";
import { validateUsername } from "./username";

describe("validateUsername", () => {
  it("한글/영문/숫자/밑줄 조합은 통과한다", () => {
    expect(validateUsername("퍼센티지")).toBeNull();
    expect(validateUsername("percentage_01")).toBeNull();
    expect(validateUsername("한글_english_123")).toBeNull();
  });

  it("빈 문자열은 실패한다", () => {
    expect(validateUsername("")).not.toBeNull();
    expect(validateUsername("   ")).not.toBeNull();
  });

  it("1자는 실패하고 2자는 통과한다", () => {
    expect(validateUsername("a")).not.toBeNull();
    expect(validateUsername("ab")).toBeNull();
  });

  it("20자를 넘으면 실패한다", () => {
    expect(validateUsername("a".repeat(20))).toBeNull();
    expect(validateUsername("a".repeat(21))).not.toBeNull();
  });

  it("공백이나 특수문자가 섞이면 실패한다", () => {
    expect(validateUsername("공백 있음")).not.toBeNull();
    expect(validateUsername("a@b.com")).not.toBeNull();
    expect(validateUsername("<script>")).not.toBeNull();
  });

  it("앞뒤 공백은 트림 후 검사한다", () => {
    expect(validateUsername("  둘레공백  ")).toBeNull();
  });
});
