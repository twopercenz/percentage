"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can, type Actor } from "@/lib/acl/can";
import { getClientIp, hashIp, maskIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rateLimit";
import { fullTitleHref, parseFullTitle } from "@/lib/wiki/title";

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

  const { error } = await supabase.rpc("create_revision", {
    p_namespace: parsed.namespace,
    p_title: parsed.title,
    p_content: content,
    p_comment: comment,
    p_editor_user_id: user?.id ?? null,
    p_editor_ip_hash: editorIpHash,
    p_editor_ip_display: editorIpDisplay,
  });

  if (error) {
    throw new Error(`저장에 실패했습니다: ${error.message}`);
  }

  redirect(fullTitleHref("/w", parsed.fullTitle));
}
