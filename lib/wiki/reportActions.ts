"use server";

import { redirect } from "next/navigation";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { resolveEditorIdentity } from "@/lib/wiki/identity";

// targetType/targetId는 신고 페이지가 URL에서 이미 정해서 넘긴다(문서 자체 또는
// 토론 댓글 하나) - 사용자가 폼으로 직접 targetId를 조작할 수 없게 서버 액션의
// bind() 인자로만 받는다.
export async function createReport(
  targetType: "document" | "discussion_comment",
  targetId: string,
  titleSegments: string[],
  formData: FormData,
) {
  const parsed = parseFullTitle(titleSegments);
  const reason = String(formData.get("reason") ?? "").trim();
  if (!reason) {
    throw new Error("신고 사유를 입력해 주세요.");
  }

  const { supabase, editorIpHash, editorIpDisplay } = await resolveEditorIdentity(
    { namespace: parsed.namespace },
    "read",
  );

  const { error } = await supabase.rpc("create_report", {
    p_target_type: targetType,
    p_target_id: targetId,
    p_reason: reason,
    p_editor_ip_hash: editorIpHash as string,
    p_editor_ip_display: editorIpDisplay as string,
  });

  if (error) {
    throw new Error(`신고를 접수하지 못했습니다: ${error.message}`);
  }

  redirect(`${fullTitleHref("/report", parsed.fullTitle)}?done=1`);
}
