"use server";

import { redirect } from "next/navigation";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { resolveEditorIdentity } from "@/lib/wiki/identity";
import { getDocumentByFullTitle } from "@/lib/wiki/queries";

function discussHref(fullTitle: string, discussionId?: string): string {
  const base = fullTitleHref("/discuss", fullTitle);
  return discussionId ? `${base}/${discussionId}` : base;
}

export async function createDiscussion(titleSegments: string[], formData: FormData) {
  const parsed = parseFullTitle(titleSegments);
  const title = String(formData.get("title") ?? "").trim();
  const content = String(formData.get("content") ?? "").trim();
  if (!title || !content) {
    throw new Error("토론 제목과 내용을 모두 입력해 주세요.");
  }

  const document = await getDocumentByFullTitle(parsed.fullTitle);
  if (!document || document.is_deleted) {
    throw new Error("문서를 찾을 수 없습니다.");
  }

  const { supabase, editorIpHash, editorIpDisplay } = await resolveEditorIdentity(
    { namespace: parsed.namespace },
    "discuss",
  );

  const { data: discussion, error } = await supabase.rpc("create_discussion", {
    p_document_id: document.id,
    p_title: title,
    p_content: content,
    p_editor_ip_hash: editorIpHash as string,
    p_editor_ip_display: editorIpDisplay as string,
  });

  if (error) {
    throw new Error(`토론을 만들지 못했습니다: ${error.message}`);
  }

  redirect(discussHref(parsed.fullTitle, discussion.id));
}

export async function addDiscussionComment(
  discussionId: string,
  titleSegments: string[],
  formData: FormData,
) {
  const parsed = parseFullTitle(titleSegments);
  const content = String(formData.get("content") ?? "").trim();
  if (!content) {
    throw new Error("내용을 입력해 주세요.");
  }

  const { supabase, editorIpHash, editorIpDisplay } = await resolveEditorIdentity(
    { namespace: parsed.namespace },
    "discuss",
  );

  const { error } = await supabase.rpc("add_discussion_comment", {
    p_discussion_id: discussionId,
    p_content: content,
    p_editor_ip_hash: editorIpHash as string,
    p_editor_ip_display: editorIpDisplay as string,
  });

  if (error) {
    throw new Error(`댓글을 남기지 못했습니다: ${error.message}`);
  }

  redirect(discussHref(parsed.fullTitle, discussionId));
}

const STATUS_VALUES = new Set(["open", "closed", "paused"]);

export async function changeDiscussionStatus(
  discussionId: string,
  titleSegments: string[],
  formData: FormData,
) {
  const parsed = parseFullTitle(titleSegments);
  const status = String(formData.get("status") ?? "");
  const note = formData.get("note");
  if (!STATUS_VALUES.has(status)) {
    throw new Error("알 수 없는 상태입니다.");
  }

  const { supabase, user } = await resolveEditorIdentity({ namespace: parsed.namespace }, "discuss");
  if (!user) {
    throw new Error("토론 상태 변경은 로그인한 사용자만 할 수 있습니다.");
  }

  const { error } = await supabase.rpc("set_discussion_status", {
    p_discussion_id: discussionId,
    p_status: status,
    p_note: note ? String(note).slice(0, 200) : undefined,
  });

  if (error) {
    throw new Error(`상태를 바꾸지 못했습니다: ${error.message}`);
  }

  redirect(discussHref(parsed.fullTitle, discussionId));
}
