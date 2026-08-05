-- 로그인 기능: auth.users에 새 계정이 생기면 profiles 행을 자동으로 만든다.
--
-- 이메일 가입은 lib/auth/actions.ts가 signUp() 호출 전에 사용자명 형식·중복을
-- 먼저 검사하지만, 그 검사와 실제 가입 사이의 경쟁 상태(동시에 같은 이름으로 가입)나
-- 소셜 로그인(폼으로 이름을 받을 기회가 아예 없음)까지 대비해 트리거 자신도
-- 방어적으로 짠다: 이름이 없거나 이미 있으면 숫자 접미사를 붙여 유일하게 만든다.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_base text;
  v_username text;
  v_suffix int := 0;
begin
  v_base := coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'username'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'user_name'), ''),
    'user_' || substr(new.id::text, 1, 8)
  );
  -- 폼에서 받은 이름이라도 너무 길면 잘라낸다(profiles.username에 길이 제약은
  -- 없지만 UI가 20자 이하를 안내하므로 여기서도 맞춰준다).
  v_base := left(v_base, 20);
  v_username := v_base;

  while exists (select 1 from public.profiles where username = v_username) loop
    v_suffix := v_suffix + 1;
    v_username := left(v_base, 20 - length('_' || v_suffix)) || '_' || v_suffix;
  end loop;

  insert into public.profiles (id, username) values (new.id, v_username);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
