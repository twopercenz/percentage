import "server-only";
import { headers } from "next/headers";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { can, type AclAction, type Actor } from "@/lib/acl/can";
import { getClientIp, hashIp, maskIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rateLimit";

// 작성자 신원(로그인 사용자면 userId, 아니면 IP 해시)을 결정하고 저장 빈도를 제한한다.
// 리비전 저장뿐 아니라 토론·편집 요청·신고처럼 "누가 썼는지" 기록이 필요한 모든
// 쓰기 액션이 공유한다 - action별로 can()의 판정 기준(§7)만 다르다.
export async function resolveEditorIdentity(actorForCheck: { namespace: string }, action: AclAction) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const actor: Actor = { userId: user?.id ?? null, permissions: [] };
  if (!can(action, actorForCheck, actor)) {
    throw new Error("이 작업을 수행할 권한이 없습니다.");
  }

  let editorIpHash: string | null = null;
  let editorIpDisplay: string | null = null;
  let rateLimitKey = user?.id ?? null;

  if (!user) {
    const headersList = await headers();
    const ip = getClientIp(headersList);
    if (!ip) {
      throw new Error("작성자 IP를 확인할 수 없습니다.");
    }
    editorIpHash = hashIp(ip);
    editorIpDisplay = maskIp(ip);
    rateLimitKey = editorIpHash;
  }

  checkRateLimit(rateLimitKey ?? "unknown");

  return { supabase, user, editorIpHash, editorIpDisplay };
}
