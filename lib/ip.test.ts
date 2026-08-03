import { describe, expect, it, vi } from "vitest";
import { getClientIp, hashIp, maskIp } from "./ip";

describe("getClientIp", () => {
  it("x-forwarded-for의 첫 번째 값을 사용한다", () => {
    const headers = new Headers({ "x-forwarded-for": "211.245.1.2, 10.0.0.1" });
    expect(getClientIp(headers)).toBe("211.245.1.2");
  });

  it("x-forwarded-for가 없으면 x-real-ip를 사용한다", () => {
    const headers = new Headers({ "x-real-ip": "1.2.3.4" });
    expect(getClientIp(headers)).toBe("1.2.3.4");
  });

  it("둘 다 없으면 null을 반환한다", () => {
    expect(getClientIp(new Headers())).toBeNull();
  });
});

describe("hashIp", () => {
  it("IP_HASH_SALT가 없으면 예외를 던진다", () => {
    vi.stubEnv("IP_HASH_SALT", "");
    expect(() => hashIp("211.245.1.2")).toThrow();
    vi.unstubAllEnvs();
  });

  it("같은 salt/IP는 항상 같은 해시를 만든다", () => {
    vi.stubEnv("IP_HASH_SALT", "test-salt");
    const a = hashIp("211.245.1.2");
    const b = hashIp("211.245.1.2");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    vi.unstubAllEnvs();
  });

  it("salt가 다르면 다른 해시가 나온다", () => {
    vi.stubEnv("IP_HASH_SALT", "salt-a");
    const a = hashIp("211.245.1.2");
    vi.stubEnv("IP_HASH_SALT", "salt-b");
    const b = hashIp("211.245.1.2");
    expect(a).not.toBe(b);
    vi.unstubAllEnvs();
  });
});

describe("maskIp", () => {
  it("IPv4는 뒤 두 옥텟을 마스킹한다", () => {
    expect(maskIp("211.245.1.2")).toBe("211.245.***.***");
  });

  it("IPv6는 뒤쪽 그룹을 마스킹한다", () => {
    expect(maskIp("2001:db8:1234:5678:9abc:def0:1234:5678")).toBe(
      "2001:db8:1234:5678:****:****:****:****",
    );
  });
});
