"use client";

import { useActionState } from "react";
import { signInWithEmail } from "@/lib/auth/actions";

const INPUT_CLASS =
  "w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[var(--accent)]";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signInWithEmail, null);

  return (
    <form action={formAction} className="flex max-w-sm flex-col gap-3">
      <input type="email" name="email" placeholder="이메일" required className={INPUT_CLASS} />
      <input type="password" name="password" placeholder="비밀번호" required className={INPUT_CLASS} />
      {state?.error ? <p className="text-sm text-[var(--danger)]">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--accent-secondary)] disabled:opacity-60"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
    </form>
  );
}
