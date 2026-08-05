import { createServerSupabaseClient } from "@/lib/supabase/server";
import { signOut } from "@/lib/auth/actions";

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-[var(--muted)]">설정을 보려면 로그인해야 합니다.</p>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, permissions, created_at")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <div className="max-w-md">
      <h1 className="mb-6 text-xl font-bold">내 계정</h1>

      <dl className="mb-8 flex flex-col gap-3 text-sm">
        <div className="flex justify-between border-b border-[var(--border)] pb-2">
          <dt className="text-[var(--muted)]">사용자명</dt>
          <dd className="font-medium">{profile?.username ?? "(알 수 없음)"}</dd>
        </div>
        <div className="flex justify-between border-b border-[var(--border)] pb-2">
          <dt className="text-[var(--muted)]">이메일</dt>
          <dd className="font-medium">{user.email ?? "(없음)"}</dd>
        </div>
        <div className="flex justify-between border-b border-[var(--border)] pb-2">
          <dt className="text-[var(--muted)]">권한</dt>
          <dd className="font-medium">{(profile?.permissions ?? []).join(", ") || "member"}</dd>
        </div>
        {profile?.created_at ? (
          <div className="flex justify-between border-b border-[var(--border)] pb-2">
            <dt className="text-[var(--muted)]">가입일</dt>
            <dd className="font-medium">{new Date(profile.created_at).toLocaleDateString("ko-KR")}</dd>
          </div>
        ) : null}
      </dl>

      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--danger)] hover:border-[var(--danger)]"
        >
          로그아웃
        </button>
      </form>
    </div>
  );
}
