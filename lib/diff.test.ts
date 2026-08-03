import { describe, expect, it } from "vitest";
import { diffLines } from "./diff";

describe("diffLines", () => {
  it("동일한 텍스트는 전부 equal이다", () => {
    const ops = diffLines("가\n나", "가\n나");
    expect(ops).toEqual([
      { type: "equal", value: "가" },
      { type: "equal", value: "나" },
    ]);
  });

  it("줄 추가를 감지한다", () => {
    const ops = diffLines("가", "가\n나");
    expect(ops).toEqual([
      { type: "equal", value: "가" },
      { type: "add", value: "나" },
    ]);
  });

  it("줄 삭제를 감지한다", () => {
    const ops = diffLines("가\n나", "가");
    expect(ops).toEqual([
      { type: "equal", value: "가" },
      { type: "remove", value: "나" },
    ]);
  });

  it("중간 줄 변경을 add/remove 조합으로 표현한다", () => {
    const ops = diffLines("가\n나\n다", "가\n다라\n다");
    expect(ops).toEqual([
      { type: "equal", value: "가" },
      { type: "remove", value: "나" },
      { type: "add", value: "다라" },
      { type: "equal", value: "다" },
    ]);
  });
});
