import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

// 이 Next.js 버전은 middleware.ts가 proxy.ts로 이름이 바뀌었다(node_modules/next/dist/docs
// 참고). 역할은 같다: Supabase 세션 쿠키를 매 요청마다 갱신한다 - 이게 없으면 액세스
// 토큰이 만료됐을 때 서버 컴포넌트(getUser())가 로그인 상태를 못 읽어서 뜬금없이
// 로그아웃된 것처럼 보인다. lib/supabase/server.ts의 주석이 가리키는 "이후 proxy에서
// 처리"가 바로 이 파일이다.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  // 호출 자체가 만료 임박한 토큰을 갱신하고 setAll을 트리거한다 - 반환값은 안 쓰지만
  // 부수효과(쿠키 갱신)가 목적이다.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
