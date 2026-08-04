"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can, type Actor } from "@/lib/acl/can";
import { getClientIp, hashIp, maskIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rateLimit";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";
import { collectCategoryTargets, collectInternalLinkTargets, parse } from "@/lib/namumark/parser";

export async function saveRevision(titleSegments: string[], formData: FormData) {
  const parsed = parseFullTitle(titleSegments);
  const content = String(formData.get("content") ?? "");
  const commentRaw = formData.get("comment");
  const comment = commentRaw ? String(commentRaw).slice(0, 200) : null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actor: Actor = { userId: user?.id ?? null, permissions: [] };
  if (!can("edit", { namespace: parsed.namespace }, actor)) {
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

  // supabase gen types는 RPC의 nullable 파라미터를 string으로만 표기한다(생성기 한계).
  // DB 함수 시그니처는 실제로 이 값들을 NULL로 받으므로 타입만 맞춰 캐스팅한다.
  const { data: revision, error } = await supabase.rpc("create_revision", {
    p_namespace: parsed.namespace,
    p_title: parsed.title,
    p_content: content,
    p_comment: comment as string,
    p_editor_user_id: (user?.id ?? null) as string,
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
