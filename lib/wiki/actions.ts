"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can, type Actor } from "@/lib/acl/can";
import { getClientIp, hashIp, maskIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rateLimit";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { collectCategoryTargets, collectInternalLinkTargets, parse } from "@/lib/namumark/parser";

// 편집자 신원(로그인 사용자면 userId, 아니면 IP 해시)을 결정하고 저장 빈도를 제한한다.
// create_revision/revert_revision처럼 편집자 식별이 필요한 모든 액션이 공유한다.
async function resolveEditorIdentity(actorForCheck: { namespace: string }, action: "edit") {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actor: Actor = { userId: user?.id ?? null, permissions: [] };
  if (!can(action, actorForCheck, actor)) {
    throw new Error("이 문서를 편집할 권한이 없습니다.");
  }

  let editorIpHash: string | null = null;
  let editorIpDisplay: string | null = null;
  let rateLimitKey = user?.id ?? null;

  if (!user) {
    const headersList = await headers();
    const ip = getClientIp(headersList);
    if (!ip) {
      throw new Error("편집자 IP를 확인할 수 없습니다.");
    }
    editorIpHash = hashIp(ip);
    editorIpDisplay = maskIp(ip);
    rateLimitKey = editorIpHash;
  }

  checkRateLimit(rateLimitKey ?? "unknown");

  return { supabase, user, editorIpHash, editorIpDisplay };
}

export async function saveRevision(titleSegments: string[], formData: FormData) {
  const parsed = parseFullTitle(titleSegments);
  const content = String(formData.get("content") ?? "");
  const commentRaw = formData.get("comment");
  const comment = commentRaw ? String(commentRaw).slice(0, 200) : null;

  const { supabase, editorIpHash, editorIpDisplay } = await resolveEditorIdentity(
    { namespace: parsed.namespace },
    "edit",
  );

  // supabase gen types는 RPC의 nullable 파라미터를 string으로만 표기한다(생성기 한계).
  // DB 함수 시그니처는 실제로 이 값들을 NULL로 받으므로 타입만 맞춰 캐스팅한다.
  // editor_user_id는 클라이언트가 지정하지 않는다 — RPC 내부에서 auth.uid()로만 정한다
  // (스푸핑 방지, 0004_move_delete_revert.sql 참고).
  const { data: revision, error } = await supabase.rpc("create_revision", {
    p_namespace: parsed.namespace,
    p_title: parsed.title,
    p_content: content,
    p_comment: comment as string,
    p_editor_ip_hash: editorIpHash as string,
    p_editor_ip_display: editorIpDisplay as string,
  });

  if (error) {
    throw new Error(`저장에 실패했습니다: ${error.message}`);
  }

  const ast = parse(content);
  const { error: syncError } = await supabase.rpc("sync_document_links", {
    p_document_id: revision.document_id,
    p_categories: collectCategoryTargets(ast),
    p_link_targets: collectInternalLinkTargets(ast),
  });

  if (syncError) {
    throw new Error(`분류·역링크 갱신에 실패했습니다: ${syncError.message}`);
  }

  redirect(fullTitleHref("/w", parsed.fullTitle));
}

export async function deleteDocument(titleSegments: string[], formData: FormData) {
  const parsed = parseFullTitle(titleSegments);
  const commentRaw = formData.get("comment");
  const comment = commentRaw ? String(commentRaw).slice(0, 200) : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actor: Actor = { userId: user?.id ?? null, permissions: [] };
  if (!can("delete", { namespace: parsed.namespace }, actor)) {
    throw new Error("문서를 삭제하려면 로그인해야 합니다.");
  }

  const { error } = await supabase.rpc("delete_document", {
    p_full_title: parsed.fullTitle,
    p_comment: comment as string,
  });

  if (error) {
    throw new Error(`삭제에 실패했습니다: ${error.message}`);
  }

  redirect(fullTitleHref("/w", parsed.fullTitle));
}

export async function revertRevision(
  documentId: string,
  targetRevisionId: string,
  targetRevNumber: number,
  titleSegments: string[],
) {
  const parsed = parseFullTitle(titleSegments);

  const { supabase, editorIpHash, editorIpDisplay } = await resolveEditorIdentity(
    { namespace: parsed.namespace },
    "edit",
  );

  const { error } = await supabase.rpc("revert_revision", {
    p_document_id: documentId,
    p_target_revision_id: targetRevisionId,
    p_comment: `r${targetRevNumber}(으)로 되돌림` as string,
    p_editor_ip_hash: editorIpHash as string,
    p_editor_ip_display: editorIpDisplay as string,
  });

  if (error) {
    throw new Error(`되돌리기에 실패했습니다: ${error.message}`);
  }

  redirect(fullTitleHref("/history", parsed.fullTitle));
}

export async function moveDocument(fromTitleSegments: string[], formData: FormData) {
  const from = parseFullTitle(fromTitleSegments);
  const toRaw = String(formData.get("to") ?? "").trim();
  if (!toRaw) {
    throw new Error("새 문서 이름을 입력해 주세요.");
  }
  const to = parseFullTitle(toRaw.split("/"));
  const commentRaw = formData.get("comment");
  const comment = commentRaw ? String(commentRaw).slice(0, 200) : "";

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actor: Actor = { userId: user?.id ?? null, permissions: [] };
  if (!can("move", { namespace: from.namespace }, actor)) {
    throw new Error("문서를 이동하려면 로그인해야 합니다.");
  }

  const { data: newFullTitle, error } = await supabase.rpc("move_document", {
    p_from_full_title: from.fullTitle,
    p_to_namespace: to.namespace,
    p_to_title: to.title,
    p_comment: comment,
  });

  if (error) {
    throw new Error(`이동에 실패했습니다: ${error.message}`);
  }

  redirect(fullTitleHref("/w", newFullTitle ?? to.fullTitle));
}
