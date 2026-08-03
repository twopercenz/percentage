실제 Supabase 프로젝트 생성 후 .env.example을 .env.local로 복사해 값 채우기
supabase init 실행 (CLI 버전에 맞는 config.toml 생성 — 로컬엔 CLI가 없어 이건 직접 생성하지 않았습니다)
supabase db reset으로 마이그레이션+seed 적용 → bun run db:types로 실제 타입 재생성 (지금 타입은 손으로 작성한 것)
로그인 흐름은 아직 없어서 현재 저장은 전부 IP 기반 익명 편집만 동작합니다 (로그인 UI는 로드맵에 별도 명시 안 됨 — 필요하시면 알려주세요)
Playwright e2e는 로컬 Supabase/브라우저가 없어 이번엔 세팅하지 않았습니다