import Link from "next/link";
import { SignupForm } from "@/components/auth/SignupForm";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  if (sent) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="mb-2 text-xl font-bold">확인 이메일을 보냈습니다</h1>
        <p className="text-sm text-[var(--muted)]">
          받은 편지함에서 확인 링크를 눌러야 로그인할 수 있습니다. 메일이 안 보이면
          스팸함도 확인해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-1 text-xl font-bold">가입</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">사용자명은 가입 후 바꿀 수 없습니다.</p>

      <SignupForm />

      <div className="my-6 flex items-center gap-3 text-xs text-[var(--muted)]">
        <div className="h-px flex-1 bg-[var(--border)]" />
        또는
        <div className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <OAuthButtons />

      <p className="mt-6 text-sm text-[var(--muted)]">
        이미 계정이 있으신가요?{" "}
        <Link href="/member/login" className="text-[var(--accent)] hover:text-[var(--accent-secondary)]">
          로그인
        </Link>
      </p>
    </div>
  );
}
