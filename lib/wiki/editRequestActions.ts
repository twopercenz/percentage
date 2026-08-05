"use server";

import { redirect } from "next/navigation";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { resolveEditorIdentity } from "@/lib/wiki/identity";
import { getDocumentByFullTitle } from "@/lib/wiki/queries";

export async function createEditRequest(titleSegments: string[], formData: FormData) {
  const parsed = parseFullTitle(titleSegments);
  const message = String(formData.get("message") ?? "").trim();
  if (!message) {
    throw new Error("요청 내용을 입력해 주세요.");
  }

  const document = await getDocumentByFullTitle(parsed.fullTitle);
  if (!document || document.is_deleted) {
    throw new Error("문서를 찾을 수 없습니다.");
  }

  const { supabase, editorIpHash, editorIpDisplay } = await resolveEditorIdentity(
    { namespace: parsed.namespace },
    "edit",
  );

  const { error } = await supabase.rpc("create_edit_request", {
    p_document_id: document.id,
    p_message: message,
    p_editor_ip_hash: editorIpHash as string,
    p_editor_ip_display: editorIpDisplay as string,
  });

  if (error) {
    throw new Error(`편집 요청을 남기지 못했습니다: ${error.message}`);
  }

  redirect(fullTitleHref("/edit-request", parsed.fullTitle));
}
