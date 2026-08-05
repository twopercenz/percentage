import { signInWithProvider } from "@/lib/auth/actions";

const PROVIDERS = [
  { id: "google", label: "Google로 계속하기" },
  { id: "github", label: "GitHub로 계속하기" },
] as const;

// 서버 컴포넌트로도 충분하다 - 각 버튼은 provider를 bind()로 고정한 Server Action을
// 그냥 제출하는 <form>일 뿐, 클라이언트 상태가 필요 없다.
export function OAuthButtons() {
  return (
    <div className="flex flex-col gap-2">
      {PROVIDERS.map(({ id, label }) => {
        const action = signInWithProvider.bind(null, id);
        return (
          <form key={id} action={action}>
            <button
              type="submit"
              className="w-full rounded-md border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--foreground)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              {label}
            </button>
          </form>
        );
      })}
    </div>
  );
}
