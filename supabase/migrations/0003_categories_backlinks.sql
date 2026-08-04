-- P1: 분류(document_categories)·역링크(backlinks) 반정규화 테이블.
-- 둘 다 문서 저장 시 파서가 뽑아낸 목록으로 전체 재계산한다(sync_document_links RPC).

create table public.document_categories (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  category_full_title text not null,
  created_at timestamptz not null default now(),
  unique (document_id, category_full_title)
);

alter table public.document_categories enable row level security;

create policy "document_categories_select_all" on public.document_categories
  for select using (true);

create table public.backlinks (
  id uuid primary key default gen_random_uuid(),
  from_document_id uuid not null references public.documents (id) on delete cascade,
  to_full_title text not null,
  created_at timestamptz not null default now(),
  unique (from_document_id, to_full_title)
);

alter table public.backlinks enable row level security;

create policy "backlinks_select_all" on public.backlinks
  for select using (true);

-- "Automatically expose new tables"가 꺼져 있는 프로젝트 설정이라
-- Data API 역할에 SELECT 권한을 명시적으로 부여해야 한다(0002_grants.sql과 동일 이유).
grant select on public.document_categories to anon, authenticated;
grant select on public.backlinks to anon, authenticated;

-- 문서 하나의 분류/링크 목록을 통째로 다시 쓴다(delete + insert). 직접 INSERT/UPDATE/DELETE
-- 권한은 주지 않고 이 RPC(SECURITY DEFINER)를 통해서만 갱신되게 한다.
create or replace function public.sync_document_links(
  p_document_id uuid,
  p_categories text[],
  p_link_targets text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.document_categories where document_id = p_document_id;
  if array_length(p_categories, 1) > 0 then
    insert into public.document_categories (document_id, category_full_title)
    select p_document_id, category
    from unnest(p_categories) as category
    on conflict (document_id, category_full_title) do nothing;
  end if;

  delete from public.backlinks where from_document_id = p_document_id;
  if array_length(p_link_targets, 1) > 0 then
    insert into public.backlinks (from_document_id, to_full_title)
    select p_document_id, target
    from unnest(p_link_targets) as target
    on conflict (from_document_id, to_full_title) do nothing;
  end if;
end;
$$;

grant execute on function public.sync_document_links(uuid, text[], text[]) to anon, authenticated;
