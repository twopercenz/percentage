const STATUS_LABEL: Record<string, string> = {
  open: "열림",
  closed: "닫힘",
  paused: "보류",
};

const STATUS_CLASS: Record<string, string> = {
  open: "text-[var(--success)]",
  closed: "text-[var(--danger)]",
  paused: "text-[var(--muted)]",
};

export function DiscussionStatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs font-bold ${STATUS_CLASS[status] ?? "text-[var(--muted)]"}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}
