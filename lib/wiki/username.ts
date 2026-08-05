// \p{L}(모든 문자 체계의 글자, 한글 포함) / \p{N}(숫자) / 밑줄만 허용한다.
// profiles.username은 가입 후 절대 바뀌지 않으므로(§5) 가입 폼과 여기 규칙이
// 어긋나면 안 된다 - 회원가입 서버 액션이 이 함수 하나로만 검증하게 한다.
const USERNAME_PATTERN = /^[\p{L}\p{N}_]+$/u;

// 통과하면 null, 실패하면 사용자에게 보여줄 한국어 에러 메시지를 돌려준다.
export function validateUsername(username: string): string | null {
  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return "사용자명을 입력해 주세요.";
  }
  if (trimmed.length < 2 || trimmed.length > 20) {
    return "사용자명은 2~20자여야 합니다.";
  }
  if (!USERNAME_PATTERN.test(trimmed)) {
    return "사용자명은 한글·영문·숫자·밑줄(_)만 사용할 수 있습니다.";
  }

  return null;
}
