<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
## 1. 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 서비스명 | **Percentage** |
| 슬로건 | **쌓으면, 보입니다.** |
| 성격 | 나무위키(namu.wiki)와 동일한 구조·기능을 가진 한국어 개방형 위키 |
| 목표 범위 | 나무위키 전 기능 풀스펙 (문서/역사/토론/ACL/관리 도구 포함) |
| 주 언어 | 한국어 (UI 문자열은 전부 한국어, 코드/주석은 영어 또는 한국어 혼용 허용) |

슬로건 "쌓으면, 보입니다."는 **누적된 편집(리비전)이 지식을 드러낸다**는 의미다.
UI 카피(빈 문서 안내, 온보딩, 푸터 등)를 작성할 때 이 톤을 유지한다.

### 법적 주의 (반드시 지킬 것)
- 나무위키의 **기능/구조/문법 사양**은 참고하되, **나무위키의 로고, 마스코트, CSS 자산, 문서 본문 텍스트**는 복제하지 않는다.
- 시드 데이터·테스트 픽스처에 실제 나무위키 문서 내용을 붙여넣지 않는다. 직접 작성한 더미 텍스트를 사용한다.
- 라이선스 표기는 CC BY-NC-SA 2.0 KR 기준 문구를 자체 작성해 푸터/편집창에 노출한다.

---

## 2. 기술 스택

- **Next.js 15+ (App Router)** / React 19 / **TypeScript strict**
- **Supabase** — PostgreSQL + Auth + Storage + Realtime (DB와 인증 모두 Supabase 사용)
- **Tailwind CSS** + CSS 변수 기반 테마 (라이트/다크)
- **패키지 매니저: bun**
- 상태관리: 서버 컴포넌트 우선, 클라이언트 상태는 최소한의 `useState` / `nuqs`(URL 상태)
- 테스트: **Vitest**(파서·유틸 단위 테스트) + **Playwright**(편집→저장→역사 등 핵심 플로우 E2E)
- 린트/포맷: ESLint + Prettier

### 선택 원칙
- 새 라이브러리 추가는 최소화한다. 특히 **위키 문법 파서는 외부 마크다운 라이브러리를 쓰지 않고 자체 구현**한다(§6).
- ORM은 두지 않는다. Supabase JS 클라이언트 + `supabase gen types typescript`로 생성한 타입을 사용한다.
- 복잡한 쓰기 로직(문서 저장, 되돌리기, 이동)은 **Postgres 함수(RPC) 또는 Route Handler 안의 트랜잭션**으로 원자성을 보장한다.

---

## 3. 명령어

```bash
bun dev               # 개발 서버
bun run build         # 프로덕션 빌드 (PR 전 반드시 통과)
bun run lint          # ESLint
bun run typecheck     # tsc --noEmit
bun run test          # Vitest (파서 테스트 포함)
bun run test:e2e      # Playwright
bun run db:types      # supabase gen types typescript --local > types/database.ts
supabase migration new <name>   # 마이그레이션 생성
supabase db reset               # 로컬 DB 초기화 + 마이그레이션 + 시드
```

**작업 완료 기준**: `bun run lint && bun run typecheck && bun run test && bun run build`가 모두 통과해야 완료로 간주한다.

---

## 4. 디렉토리 구조

```
app/
  (wiki)/
    w/[...title]/page.tsx        # 문서 보기
    edit/[...title]/page.tsx     # 편집
    history/[...title]/page.tsx  # 역사
    diff/[...title]/page.tsx     # 두 리비전 비교
    raw/[...title]/page.tsx      # 원본 마크업
    discuss/[...title]/          # 토론 목록/스레드
    acl/[...title]/page.tsx      # ACL 설정
    backlink/[...title]/page.tsx # 역링크
  (meta)/
    RecentChanges/               # 최근 변경
    search/                      # 검색
    admin/                       # 관리자 도구(차단, 신고 처리, 권한 부여)
    member/                      # 로그인/가입/설정
  api/                           # Route Handlers (편집 저장, 되돌리기, 이동 등)
lib/
  namumark/                      # ★ 위키 문법 파서 (핵심 모듈)
    lexer.ts  parser.ts  renderer.tsx  macros/  __tests__/
  supabase/                      # server.ts / client.ts / admin.ts
  acl/                           # 권한 판정 로직
  ip.ts                          # IP 추출·해싱·마스킹
components/
  wiki/                          # 문서 렌더 관련 UI
  layout/                        # 헤더, 사이드바, 푸터
  ui/                            # 원시 UI 요소
types/database.ts                # Supabase 생성 타입 (직접 수정 금지)
supabase/
  migrations/*.sql
  seed.sql
```

> 이 프로젝트는 `src/` 디렉토리를 사용하지 않는다. `app/`, `lib/`, `components/`, `types/`는 모두 저장소 루트에 위치한다.

---

## 5. 데이터 모델 (핵심 테이블)

모든 테이블에 **RLS를 켜고**, 쓰기는 원칙적으로 Route Handler/RPC를 통해서만 수행한다.

- **profiles** — `id`(auth.users FK), `username`(변경 불가), `created_at`, `permissions`(text[]: `member`, `editable_other_namespace`, `admin` 등), `is_blocked`
- **documents** — `id`, `namespace`, `title`, `full_title`(unique, `네임스페이스:제목`), `current_revision_id`, `is_deleted`, `redirect_target`, `updated_at`
- **revisions** — `id`, `document_id`, `rev_number`(문서 내 1부터 증가), `content`(원본 마크업), `comment`(편집 요약), `type`(`create|modify|delete|revert|move`), `editor_user_id`(nullable), `editor_ip_hash`, `editor_ip_display`, `byte_size`, `byte_diff`, `is_hidden`, `created_at`
  - **리비전은 절대 UPDATE/DELETE 하지 않는다.** 되돌리기도 "새 리비전 추가"로 처리한다.
- **document_categories** — 렌더 시 파싱된 `[[분류:...]]`를 반정규화 저장
- **backlinks** — `from_document_id`, `to_full_title` (문서 저장 시 재계산)
- **discussions / discussion_comments** — 스레드 상태(`open|closed|paused`), 코멘트 타입(`text|status_change|acl_change`)
- **acl_rules** — 대상(`document|namespace`), 액션(`read|edit|move|delete|discuss|acl`), 조건(`everyone|member|member_signup_15d|ip:CIDR|user:username|admin`), `allow|deny`, `priority`
- **blocks** — 차단 대상(user/ip), 사유, 만료일
- **reports** — 신고 접수/처리 상태
- **edit_requests** — 편집 권한이 없는 문서에 대한 편집 요청
- **watches** — 문서 감시 목록
- **files** — Supabase Storage 경로, 업로더, 라이선스 정보

### 네임스페이스 (고정 목록)
`문서`(기본, prefix 없음), `틀`, `분류`, `파일`, `사용자`, `Percentage`(프로젝트), `토론`, `휴지통`

---

## 6. 위키 문법 파서 (`src/lib/namumark`) — 가장 중요한 모듈

### 아키텍처
```
원본 마크업 → lexer(토큰) → parser(AST) → renderer(React 엘리먼트)
```
- **`dangerouslySetInnerHTML`을 기본 경로로 사용하지 않는다.** AST를 React 엘리먼트로 직접 렌더한다.
- `{{{#!html}}}` 블록만 예외적으로 HTML을 허용하되, **관리자 권한 문서에서만** 동작하게 하고 sanitize-html로 정화한다.
- 파서는 **순수 함수**여야 한다(DB·네트워크 접근 금지). 링크 존재 여부(빨간 링크) 같은 외부 정보는 AST 생성 후 별도 단계에서 주입한다.
- 렌더 결과는 리비전 단위로 캐시 가능해야 한다(같은 입력 → 같은 AST).

### 지원해야 할 문법 (구현 순서 = 우선순위)
1. 문단: `= 제목 =` ~ `====== 제목 ======`, 접기 가능한 문단, 자동 문단 번호
2. 텍스트: `'''굵게'''`, `''기울임''`, `__밑줄__`, `~~취소선~~`, `--취소선--`, `^^위첨자^^`, `,,아래첨자,,`
3. 링크: `[[문서]]`, `[[문서|표시]]`, `[[#앵커]]`, `[[파일:name.png|width=300]]`, 외부 링크 `[[https://...|표시]]`, 빨간 링크(존재하지 않는 문서) 처리
4. 리스트: `*`, `1.`, `A.`, `a.`, `I.` / 들여쓰기 중첩
5. 인용: `>`, 수평선 `----`
6. 표: `|| 셀 || 셀 ||` + 옵션(`<table align=center>`, `<width=50%>`, `<bgcolor=#fff>`, `<-2>` 병합, `<|2>` 병합)
7. 블록: `{{{ }}}`(코드), `{{{#!syntax python }}}`, `{{{#!wiki style="..." }}}`, `{{{#!folding 제목 }}}`, `{{{+1 크게}}}`, `{{{#색상 텍스트}}}`
8. 각주: `[* 내용]`, `[*이름 내용]`, `[각주]`
9. 매크로: `[br]`, `[목차]` / `[tableofcontents]`, `[include(틀:이름, 인자=값)]`, `[date]`, `[age(YYYY-MM-DD)]`, `[dday(...)]`, `[ruby(글자, ruby=루비)]`, `[anchor(...)]`, `[pagecount]`
10. 특수: `[[분류:이름]]`(하단 분류 표시), `#redirect 문서명`(문서 첫 줄), 주석 `##`

### 파서 작업 규칙
- 문법을 추가/수정하면 **반드시 `__tests__`에 입력 마크업 → 기대 AST 스냅샷 테스트를 추가**한다.
- 잘못된 문법(닫히지 않은 태그 등)은 예외를 던지지 말고 **원문 그대로 출력**한다. 파서는 절대 크래시하지 않는다.
- 성능 목표: 100KB 문서를 100ms 이내 파싱. 정규식 백트래킹이 폭발하는 패턴을 피한다.

---

## 7. 인증 및 편집 권한 (나무위키식)

- **비로그인 IP 편집을 허용한다.** 로그인은 Supabase Auth(이메일 + 소셜)로 처리한다.
- 편집자 식별:
  - 로그인 사용자 → `editor_user_id`, 표시는 `username`
  - 비로그인 → `editor_ip_hash`(salt + SHA-256, 원본 IP는 저장하지 않음), 표시는 마스킹된 문자열 (예: `211.245.***.***`)
  - IP는 `headers().get('x-forwarded-for')`의 첫 번째 값을 사용하고, 신뢰 프록시 목록으로 검증한다.
  - **원본 IP 평문은 로그·DB 어디에도 남기지 않는다.** IP 차단은 해시 비교 또는 CIDR 대조로 처리한다.
- ACL 판정은 `src/lib/acl/`의 단일 함수 `can(action, document, actor)`를 통해서만 수행한다. 컴포넌트에서 권한 조건을 직접 하드코딩하지 않는다.
- 기본 정책: 읽기=모두, 편집=모두(IP 포함), 삭제/이동=로그인 사용자, ACL 변경=관리자.
- 문서별 ACL은 네임스페이스 규칙보다 우선하며, `deny`가 `allow`보다 우선한다.

---

## 8. UI / 디자인 가이드

- 레이아웃: 상단 고정 헤더(로고 + 검색 + 계정), 좌측 사이드바(최근 변경/랜덤 문서/도구), 본문 우측 상단에 편집·역사·토론 버튼 그룹.
- 본문 폰트는 가독성 우선 (Pretendard 계열), 본문 최대 폭 제한, 문단 번호는 회색 소형 텍스트.
- 다크 모드는 CSS 변수 토글로 구현하고, 색상값을 컴포넌트에 하드코딩하지 않는다.
- 로고/워드마크는 **직접 디자인**한다. 슬로건은 푸터와 빈 문서 화면에 노출한다.
  - 빈 문서 예시 카피: *"아직 이 문서에는 아무것도 쌓이지 않았습니다."*
- 모바일에서 표는 가로 스크롤 컨테이너로 감싼다.

---

## 9. 코딩 컨벤션

- 서버 컴포넌트가 기본. `'use client'`는 상호작용이 필요한 최소 단위 컴포넌트에만 붙인다.
- 데이터 조회는 서버 컴포넌트에서, 변경은 Server Action 또는 Route Handler에서 수행한다.
- `any` 금지. Supabase 응답은 생성된 `Database` 타입으로 좁힌다.
- 파일명: 컴포넌트 `PascalCase.tsx`, 그 외 `camelCase.ts`. 함수는 동사로 시작.
- 에러는 삼키지 말고 사용자용 한국어 메시지 + 서버 로그로 분리한다.
- 커밋 메시지: `feat|fix|refactor|test|docs(scope): 설명` (한국어 설명 허용)

---

## 10. 보안 체크리스트

- 모든 테이블 RLS ON. `service_role` 키는 서버 전용 코드에서만 import (`lib/supabase/admin.ts`).
- 사용자 입력 마크업은 AST 렌더 경로로만 출력. 문자열 HTML 결합 금지.
- 편집 저장에 rate limit 적용 (IP/계정 단위).
- 문서 이동·삭제·되돌리기는 서버에서 권한 재검증 (클라이언트 판단 신뢰 금지).
- Storage 업로드는 확장자·MIME·용량 검증 후 허용.

---

## 11. 개발 로드맵 (현재 위치를 여기서 갱신할 것)

- [ ] **P0** 프로젝트 셋업, Supabase 스키마, 문서 보기/편집/저장, 역사, diff
- [ ] **P1** 위키 문법 파서 1~6단계, 검색, 최근 변경, 분류, 역링크
- [ ] **P2** 파서 7~10단계(틀/include/각주/매크로), 파일 업로드, 문서 이동·삭제·되돌리기
- [ ] **P3** 토론 시스템, 편집 요청, 신고
- [ ] **P4** ACL, 차단, 관리자 도구, 감시 목록
- [ ] **P5** 성능(렌더 캐시, ISR), 접근성, 모바일 최적화

---

## 12. Claude Code 작업 규칙

**할 것**
- 작업 시작 전 관련 섹션과 기존 코드를 먼저 읽는다.
- 스키마를 바꾸면 `supabase/migrations`에 SQL 마이그레이션을 추가하고 `pnpm db:types`를 실행한다.
- 파서·ACL·권한 관련 변경에는 테스트를 함께 작성한다.
- 큰 기능은 단계를 나눠 제안하고, 각 단계마다 빌드/테스트가 통과하는 상태를 유지한다.
- 사양이 모호하면 추측해서 대규모 코드를 쏟아내지 말고 **먼저 질문한다.**

**하지 말 것**
- `types/database.ts` 직접 수정
- 위키 문법을 위해 `marked`, `remark` 등 외부 마크다운 파서 도입
- `revisions` 레코드 수정·삭제
- 나무위키의 실제 문서 텍스트·이미지·로고를 코드나 시드에 포함
- RLS 비활성화, `service_role` 키의 클라이언트 노출
- 요청하지 않은 라이브러리 추가나 대규모 리팩터링

---

## 13. 용어집

| 용어 | 의미 |
|---|---|
| 리비전(revision) | 문서의 한 편집 버전. 불변 |
| r15 | 15번째 리비전 |
| 역링크 | 해당 문서를 링크하는 다른 문서 목록 |
| ACL | 문서·네임스페이스별 행위 권한 규칙 |
| 틀(template) | `[include(틀:이름)]`으로 삽입되는 재사용 문서 |
| 나무마크 → **퍼마크(PerMark)** | 본 프로젝트의 위키 문법 명칭 (코드/문서에서 이 이름 사용) |
