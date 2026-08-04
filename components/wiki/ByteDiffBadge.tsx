export function ByteDiffBadge({ byteDiff }: { byteDiff: number }) {
  const className =
    byteDiff > 0
      ? "text-[var(--success)]"
      : byteDiff < 0
        ? "text-[var(--danger)]"
        : "text-[var(--muted)]";

  return <span className={className}>{byteDiff > 0 ? `+${byteDiff}` : byteDiff}</span>;
}
