import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// OAuth(Google/GitHub)와 이메일 확인 링크가 공통으로 돌아오는 곳이다. 둘 다
// Supabase가 PKCE ?code= 파라미터를 붙여 이 주소로 리다이렉트하고, 여기서
// 세션으로 교환한 뒤 원래 가려던 곳(next, 없으면 홈)으로 다시 보낸다.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }

  return NextResponse.redirect(new URL("/member/login?error=1", url.origin));
}
