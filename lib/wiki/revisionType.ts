const LABELS: Record<string, string> = {
  create: "생성",
  modify: "수정",
  delete: "삭제",
  revert: "되돌림",
  move: "이동",
};

export function revisionTypeLabel(type: string): string {
  return LABELS[type] ?? type;
}
