import type { RevisionRow } from "@/lib/wiki/queries";

export function editorDisplayName(
  revision: Pick<RevisionRow, "editor_user_id" | "editor_ip_display">,
  usernameById: Map<string, string>,
): string {
  if (revision.editor_user_id) {
    return usernameById.get(revision.editor_user_id) ?? "(알 수 없는 사용자)";
  }
  return revision.editor_ip_display ?? "(알 수 없는 IP)";
}
