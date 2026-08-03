-- P0: profiles, documents, revisions 기본 스키마
-- 리비전은 절대 UPDATE/DELETE 하지 않는다. 되돌리기도 새 리비전 추가로 처리한다(향후 단계).

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  created_at timestamptz not null default now(),
  permissions text[] not null default array['member'],
  is_blocked boolean not null default false
);

alter table public.profiles enable row level security;

create policy "profiles_select_all" on public.profiles
  for select using (true);

create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  namespace text not null check (
    namespace in ('문서', '틀', '분류', '파일', '사용자', 'Percentage', '토론', '휴지통')
  ),
  title text not null,
  full_title text not null unique,
  current_revision_id uuid,
  is_deleted boolean not null default false,
  redirect_target text,
  updated_at timestamptz not null default now()
);

alter table public.documents enable row level security;

create policy "documents_select_all" on public.documents
  for select using (true);

create table public.revisions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  rev_number integer not null,
  content text not null default '',
  comment text,
  type text not null check (type in ('create', 'modify', 'delete', 'revert', 'move')),
  editor_user_id uuid references public.profiles (id),
  editor_ip_hash text,
  editor_ip_display text,
  byte_size integer not null default 0,
  byte_diff integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (document_id, rev_number),
  constraint editor_identity_present check (
    editor_user_id is not null or editor_ip_hash is not null
  )
);

alter table public.documents
  add constraint documents_current_revision_id_fkey
  foreign key (current_revision_id) references public.revisions (id);

alter table public.revisions enable row level security;

create policy "revisions_select_all" on public.revisions
  for select using (true);

-- 리비전 쓰기는 create_revision() RPC(SECURITY DEFINER)를 통해서만 수행한다.
-- documents/revisions에 INSERT/UPDATE/DELETE RLS 정책을 두지 않아 클라이언트의 직접 쓰기를 차단한다.

create or replace function public.create_revision(
  p_namespace text,
  p_title text,
  p_content text,
  p_comment text,
  p_editor_user_id uuid,
  p_editor_ip_hash text,
  p_editor_ip_display text
)
returns public.revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_full_title text;
  v_document public.documents;
  v_prev_revision public.revisions;
  v_next_rev_number integer;
  v_type text;
  v_byte_size integer;
  v_byte_diff integer;
  v_revision public.revisions;
begin
  if p_editor_user_id is null and p_editor_ip_hash is null then
    raise exception '편집자 식별 정보(로그인 사용자 또는 IP 해시)가 필요합니다.';
  end if;

  v_full_title := case
    when p_namespace = '문서' then p_title
    else p_namespace || ':' || p_title
  end;

  select * into v_document from public.documents where full_title = v_full_title;

  if v_document.id is null then
    insert into public.documents (namespace, title, full_title)
    values (p_namespace, p_title, v_full_title)
    returning * into v_document;

    v_next_rev_number := 1;
    v_type := 'create';
  else
    if v_document.is_deleted then
      raise exception '삭제된 문서입니다.';
    end if;

    select * into v_prev_revision
      from public.revisions
      where document_id = v_document.id
      order by rev_number desc
      limit 1;

    v_next_rev_number := coalesce(v_prev_revision.rev_number, 0) + 1;
    v_type := 'modify';
  end if;

  v_byte_size := octet_length(p_content);
  v_byte_diff := v_byte_size - coalesce(v_prev_revision.byte_size, 0);

  insert into public.revisions (
    document_id, rev_number, content, comment, type,
    editor_user_id, editor_ip_hash, editor_ip_display,
    byte_size, byte_diff
  )
  values (
    v_document.id, v_next_rev_number, p_content, p_comment, v_type,
    p_editor_user_id, p_editor_ip_hash, p_editor_ip_display,
    v_byte_size, v_byte_diff
  )
  returning * into v_revision;

  update public.documents
    set current_revision_id = v_revision.id, updated_at = now()
    where id = v_document.id;

  return v_revision;
end;
$$;

grant execute on function public.create_revision(
  text, text, text, text, uuid, text, text
) to anon, authenticated;
