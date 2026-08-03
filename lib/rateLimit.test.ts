import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rateLimit";

describe("checkRateLimit", () => {
  it("한도 내 요청은 통과한다", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(() => checkRateLimit(key)).not.toThrow();
    }
  });

  it("한도를 초과하면 예외를 던진다", () => {
    const key = `test-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(key);
    expect(() => checkRateLimit(key)).toThrow();
  });

  it("키가 다르면 서로 영향을 주지 않는다", () => {
    const keyA = `test-a-${Math.random()}`;
    const keyB = `test-b-${Math.random()}`;
    for (let i = 0; i < 5; i++) checkRateLimit(keyA);
    expect(() => checkRateLimit(keyB)).not.toThrow();
  });
});
