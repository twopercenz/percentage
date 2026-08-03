import { createHash } from "node:crypto";

export function getClientIp(headersList: Headers): string | null {
  const forwardedFor = headersList.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = headersList.get("x-real-ip");
  return realIp?.trim() || null;
}

export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT;
  if (!salt) {
    throw new Error("IP_HASH_SALT 환경변수가 설정되지 않았습니다.");
  }
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

export function maskIp(ip: string): string {
  if (ip.includes(":")) {
    const groups = ip.split(":");
    const visibleCount = Math.max(groups.length - 4, 0);
    return groups.map((group, index) => (index < visibleCount ? group : "****")).join(":");
  }

  const octets = ip.split(".");
  if (octets.length !== 4) return "***.***.***.***";
  return `${octets[0]}.${octets[1]}.***.***`;
}
