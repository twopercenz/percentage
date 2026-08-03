const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

const hits = new Map<string, number[]>();

// 프로세스 메모리 기반 임시 구현이다. 다중 인스턴스로 확장하면
// Redis 등 공유 저장소 기반 rate limit으로 교체해야 한다.
export function checkRateLimit(key: string): void {
  const now = Date.now();
  const timestamps = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (timestamps.length >= MAX_REQUESTS) {
    throw new Error("편집 저장이 너무 잦습니다. 잠시 후 다시 시도해 주세요.");
  }

  timestamps.push(now);
  hits.set(key, timestamps);
}
