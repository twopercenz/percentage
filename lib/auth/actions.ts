"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { validateUsername } from "@/lib/wiki/username";
import { getClientIp } from "@/lib/ip";
import { checkRateLimit } from "@/lib/rateLimit";

// x-forwarded-* 를 신뢰하는 건 lib/ip.ts와 같은 전제다(프록시 뒤에서 도는 배포 환경).
// OAuth/이메일 확인 링크가 되돌아올 주소(emailRedirectTo/redirectTo)를 만드는 데 쓴다.
async function getOrigin(): Promise<string> {
  const headersList = await headers();
  const host = headersList.get("x-forwarded-host") ?? headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") ?? "http";
  return `${protocol}://${host}`;
}

// 가입/로그인 시도 자체를 IP 단위로 제한한다(브루트포스 방지). 편집 저장과는
// 별개 키 공간("auth:" 접두사)을 써서 서로 한도를 깎아먹지 않게 한다.
async function rateLimitAuth() {
  const headersList = await headers();
  const ip = getClientIp(headersList) ?? "unknown";
  checkRateLimit(`auth:${ip}`, "시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.");
}

// Server Action이 던진 Error의 message는 프로덕션 빌드에서 클라이언트로 그대로
// 전달되지 않는다(다이제스트로 대체됨 - Next.js가 의도한 보안 동작). "비밀번호가
// 틀렸습니다" 같은 흔한 실패를 사용자에게 실제로 보여주려면 값으로 돌려줘야 하므로,
// 로그인/가입 두 액션만 useActionState와 짝을 이루는 (prevState, formData) 시그니처를
// 쓴다. redirect()는 반드시 try/catch 바깥에서 불러야 한다 - redirect() 자신도
// 내부적으로 예외를 던져 흐름을 제어하는데, catch가 이를 "실패"로 오인해 삼켜버리면
// 리다이렉트가 조용히 무효화된다.
export type AuthActionState = { error: string } | null;

export async function signUpWithEmail(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const username = String(formData.get("username") ?? "").trim();
  let redirectTo: string;

  try {
    await rateLimitAuth();

    const usernameError = validateUsername(username);
    if (usernameError) throw new Error(usernameError);
    if (!email) throw new Error("이메일을 입력해 주세요.");
    if (password.length < 8) throw new Error("비밀번호는 8자 이상이어야 합니다.");

    const supabase = await createServerSupabaseClient();

    // 트리거(handle_new_user)도 방어적으로 중복을 처리하지만, 여기서 먼저 걸러야
    // "가입은 됐는데 원하던 이름이 아니게 잘렸다" 같은 당황스러운 결과를 막는다.
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) throw new Error("이미 사용 중인 사용자명입니다.");

    const origin = await getOrigin();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${origin}/auth/callback`,
      },
    });
    if (error) throw new Error(`가입에 실패했습니다: ${error.message}`);

    // "이메일 확인" 설정이 꺼져 있으면 session이 바로 오고, 켜져 있으면 null이라
    // 메일함을 확인해야 한다(signup 페이지가 ?sent=1로 안내한다).
    redirectTo = data.session ? "/" : "/member/signup?sent=1";
  } catch (err) {
    return { error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다." };
  }

  redirect(redirectTo);
}

export async function signInWithEmail(
  _prevState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  try {
    await rateLimitAuth();
    if (!email || !password) throw new Error("이메일과 비밀번호를 입력해 주세요.");

    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("이메일 또는 비밀번호가 올바르지 않습니다.");
  } catch (err) {
    return { error: err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createServerSupabaseClient();
  await supabase.auth.signOut();
  redirect("/");
}

const OAUTH_PROVIDERS = ["google", "github"] as const;
type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

function isOAuthProvider(value: string): value is OAuthProvider {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

// 로그인 버튼 폼에서 provider를 bind()로 고정해 호출한다(사용자가 임의의
// provider 문자열을 보낼 수 없게).
export async function signInWithProvider(provider: string) {
  if (!isOAuthProvider(provider)) {
    throw new Error("지원하지 않는 로그인 방식입니다.");
  }

  await rateLimitAuth();

  const origin = await getOrigin();
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback` },
  });

  if (error || !data.url) {
    throw new Error(`로그인을 시작하지 못했습니다: ${error?.message ?? "알 수 없는 오류"}`);
  }

  redirect(data.url);
}
