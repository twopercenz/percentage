import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-xl font-bold">로그인</h1>

      {error ? (
        <p className="mb-4 text-sm text-[var(--danger)]">
          로그인 링크가 만료됐거나 잘못됐습니다. 다시 시도해 주세요.
        </p>
      ) : null}

      <LoginForm />

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
        <div className="h-px flex-1 bg-[var(--border)]" />
        또는
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <OAuthButtons />

      <p className="mt-6 text-sm text-[var(--muted)]">
        아직 계정이 없으신가요?{" "}
        <Link href="/member/signup" className="text-[var(--accent)] hover:text-[var(--accent-secondary)]">
          가입하기
        </Link>
      </p>
    </div>
  );
}
