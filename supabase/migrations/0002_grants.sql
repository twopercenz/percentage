-- "Automatically expose new tables"를 꺼둔 프로젝트 설정에서는 RLS 정책만으로는 부족하고
-- Data API 역할(anon/authenticated)에 테이블 단위 GRANT가 별도로 필요하다.
-- RLS 정책이 "어떤 행을 볼 수 있는가"를 결정한다면, GRANT는 "테이블에 접근 자체가 가능한가"를 결정한다.

grant select on public.documents to anon, authenticated;
grant select on public.revisions to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant update on public.profiles to authenticated;

-- INSERT/UPDATE/DELETE 권한은 documents/revisions에 부여하지 않는다.
-- 쓰기는 create_revision() RPC(SECURITY DEFINER)를 통해서만 이뤄지며,
-- 그 함수는 이미 0001_init.sql에서 anon/authenticated에 EXECUTE 권한을 부여받았다.
