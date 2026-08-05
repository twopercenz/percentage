-- P3: 토론 시스템, 편집 요청, 신고.
--
-- 셋 다 "누가 썼는지" 식별 방식이 리비전과 완전히 같다(로그인 사용자 → *_user_id,
-- 비로그인 → *_ip_hash/*_ip_display). can("discuss", ...)이 이미 비로그인 IP도
-- 허용하므로(lib/acl/can.ts) 여기서도 로그인을 강제하지 않는다 - 단, 토론 상태
-- 변경(닫기/재개/보류)만은 이동·삭제와 같은 급으로 보고 로그인 사용자로 제한한다.

-- ── 토론(discussions/discussion_comments) ──────────────────────────────

create table public.discussions (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  title text not null,
  status text not null default 'open' check (status in ('open', 'closed', 'paused')),
  creator_user_id uuid references public.profiles (id),
  creator_ip_hash text,
  creator_ip_display text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.discussions enable row level security;

create policy "discussions_select_all" on public.discussions
  for select using (true);

-- type: 'text'(일반 댓글) | 'status_change'(상태 변경 기록) | 'acl_change'(P4 ACL 변경
-- 기록용 - acl_rules가 생기기 전까지는 만들어지지 않는다).
create table public.discussion_comments (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.discussions (id) on delete cascade,
  type text not null default 'text' check (type in ('text', 'status_change', 'acl_change')),
  content text not null,
  author_user_id uuid references public.profiles (id),
  author_ip_hash text,
  author_ip_display text,
  created_at timestamptz not null default now()
);

alter table public.discussion_comments enable row level security;

create policy "discussion_comments_select_all" on public.discussion_comments
  for select using (true);

-- ── 편집 요청(edit_requests) ────────────────────────────────────────────
-- 지금은 acl_rules가 없어(P4) 모든 문서가 누구나 편집 가능하므로 이 요청이 어떤
-- 편집도 실제로 막지 않는다. 그래도 제출·목록 확인은 미리 만들어 두고, 승인/거절
-- 처리(누가 승인할 권한이 있는지)는 ACL이 생기는 P4에서 이어 붙인다.
create table public.edit_requests (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.documents (id) on delete cascade,
  message text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requester_user_id uuid references public.profiles (id),
  requester_ip_hash text,
  requester_ip_display text,
  created_at timestamptz not null default now()
);

alter table public.edit_requests enable row level security;

create policy "edit_requests_select_all" on public.edit_requests
  for select using (true);

-- ── 신고(reports) ────────────────────────────────────────────────────
-- target_type/target_id는 다형 참조라 외래키를 걸지 않는다(documents 또는
-- discussion_comments를 가리킴) - 대신 create_report() RPC가 대상 존재 여부를 검증한다.
-- 신고 처리(관리자 검토 큐)는 관리자 도구와 함께 P4에서 만든다 - 지금은 접수까지만.
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('document', 'discussion_comment')),
  target_id uuid not null,
  reason text not null,
  status text not null default 'pending' check (status in ('pending', 'resolved', 'dismissed')),
  reporter_user_id uuid references public.profiles (id),
  reporter_ip_hash text,
  reporter_ip_display text,
  created_at timestamptz not null default now()
);

alter table public.reports enable row level security;

-- 신고는 신고자 본인과 (앞으로 만들 P4) 관리자만 봐야 한다 - 아무나 신고 목록을
-- 훑을 수 있으면 그 자체로 뒷담화/괴롭힘 도구가 된다. 지금은 관리자 뷰가 없으니
-- 사실상 "아무도 select 못 함"에 가깝지만, 신고 제출(RPC)에는 지장이 없다.
create policy "reports_select_admin_only" on public.reports
  for select using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and 'admin' = any(permissions)
    )
  );

-- "Automatically expose new tables"가 꺼져 있는 프로젝트 설정이라 Data API 역할에
-- SELECT 권한을 명시적으로 부여해야 한다(0002_grants.sql과 동일 이유). reports는
-- RLS 정책 자체가 관리자로 좁혀 놓았으므로 anon/authenticated에 SELECT를 줘도 안전하다.
grant select on public.discussions to anon, authenticated;
grant select on public.discussion_comments to anon, authenticated;
grant select on public.edit_requests to anon, authenticated;
grant select on public.reports to anon, authenticated;

-- ── RPC ─────────────────────────────────────────────────────────────
-- 전부 SECURITY DEFINER + auth.uid()로만 로그인 신원을 결정한다(create_revision과
-- 같은 이유 - 클라이언트가 임의의 user_id를 주장하지 못하게 막는다).

create function public.create_discussion(
  p_document_id uuid,
  p_title text,
  p_content text,
  p_editor_ip_hash text,
  p_editor_ip_display text
)
returns public.discussions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_document public.documents;
  v_discussion public.discussions;
begin
  if v_editor_user_id is null and p_editor_ip_hash is null then
    raise exception '작성자 식별 정보(로그인 사용자 또는 IP 해시)가 필요합니다.';
  end if;
  if btrim(coalesce(p_title, '')) = '' then
    raise exception '토론 제목을 입력해 주세요.';
  end if;
  if btrim(coalesce(p_content, '')) = '' then
    raise exception '내용을 입력해 주세요.';
  end if;

  select * into v_document from public.documents where id = p_document_id;
  if v_document.id is null or v_document.is_deleted then
    raise exception '문서를 찾을 수 없습니다.';
  end if;

  insert into public.discussions (document_id, title, creator_user_id, creator_ip_hash, creator_ip_display)
  values (
    p_document_id, p_title, v_editor_user_id,
    case when v_editor_user_id is null then p_editor_ip_hash else null end,
    case when v_editor_user_id is null then p_editor_ip_display else null end
  )
  returning * into v_discussion;

  insert into public.discussion_comments (discussion_id, type, content, author_user_id, author_ip_hash, author_ip_display)
  values (
    v_discussion.id, 'text', p_content, v_editor_user_id,
    case when v_editor_user_id is null then p_editor_ip_hash else null end,
    case when v_editor_user_id is null then p_editor_ip_display else null end
  );

  return v_discussion;
end;
$$;

grant execute on function public.create_discussion(uuid, text, text, text, text) to anon, authenticated;

create function public.add_discussion_comment(
  p_discussion_id uuid,
  p_content text,
  p_editor_ip_hash text,
  p_editor_ip_display text
)
returns public.discussion_comments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_discussion public.discussions;
  v_comment public.discussion_comments;
begin
  if v_editor_user_id is null and p_editor_ip_hash is null then
    raise exception '작성자 식별 정보(로그인 사용자 또는 IP 해시)가 필요합니다.';
  end if;
  if btrim(coalesce(p_content, '')) = '' then
    raise exception '내용을 입력해 주세요.';
  end if;

  select * into v_discussion from public.discussions where id = p_discussion_id;
  if v_discussion.id is null then
    raise exception '토론을 찾을 수 없습니다.';
  end if;
  if v_discussion.status = 'closed' then
    raise exception '닫힌 토론에는 댓글을 달 수 없습니다.';
  end if;

  insert into public.discussion_comments (discussion_id, type, content, author_user_id, author_ip_hash, author_ip_display)
  values (
    p_discussion_id, 'text', p_content, v_editor_user_id,
    case when v_editor_user_id is null then p_editor_ip_hash else null end,
    case when v_editor_user_id is null then p_editor_ip_display else null end
  )
  returning * into v_comment;

  update public.discussions set updated_at = now() where id = p_discussion_id;

  return v_comment;
end;
$$;

grant execute on function public.add_discussion_comment(uuid, text, text, text) to anon, authenticated;

-- 상태 변경(열기/닫기/보류)은 이동·삭제와 같은 급으로 보고 로그인 사용자만 허용한다.
create function public.set_discussion_status(
  p_discussion_id uuid,
  p_status text,
  p_note text default null
)
returns public.discussions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_discussion public.discussions;
  v_label text;
begin
  if v_editor_user_id is null then
    raise exception '토론 상태 변경은 로그인한 사용자만 할 수 있습니다.';
  end if;
  if p_status not in ('open', 'closed', 'paused') then
    raise exception '알 수 없는 상태입니다: %', p_status;
  end if;

  select * into v_discussion from public.discussions where id = p_discussion_id;
  if v_discussion.id is null then
    raise exception '토론을 찾을 수 없습니다.';
  end if;

  v_label := case p_status
    when 'open' then '열림'
    when 'closed' then '닫힘'
    else '보류'
  end;

  update public.discussions set status = p_status, updated_at = now()
    where id = p_discussion_id
    returning * into v_discussion;

  insert into public.discussion_comments (discussion_id, type, content, author_user_id)
  values (
    p_discussion_id, 'status_change',
    '상태를 ''' || v_label || '''(으)로 변경했습니다.' || coalesce(' ' || nullif(btrim(p_note), ''), ''),
    v_editor_user_id
  );

  return v_discussion;
end;
$$;

grant execute on function public.set_discussion_status(uuid, text, text) to authenticated;

create function public.create_edit_request(
  p_document_id uuid,
  p_message text,
  p_editor_ip_hash text,
  p_editor_ip_display text
)
returns public.edit_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_document public.documents;
  v_request public.edit_requests;
begin
  if v_editor_user_id is null and p_editor_ip_hash is null then
    raise exception '요청자 식별 정보(로그인 사용자 또는 IP 해시)가 필요합니다.';
  end if;
  if btrim(coalesce(p_message, '')) = '' then
    raise exception '요청 내용을 입력해 주세요.';
  end if;

  select * into v_document from public.documents where id = p_document_id;
  if v_document.id is null or v_document.is_deleted then
    raise exception '문서를 찾을 수 없습니다.';
  end if;

  insert into public.edit_requests (document_id, message, requester_user_id, requester_ip_hash, requester_ip_display)
  values (
    p_document_id, p_message, v_editor_user_id,
    case when v_editor_user_id is null then p_editor_ip_hash else null end,
    case when v_editor_user_id is null then p_editor_ip_display else null end
  )
  returning * into v_request;

  return v_request;
end;
$$;

grant execute on function public.create_edit_request(uuid, text, text, text) to anon, authenticated;

create function public.create_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_editor_ip_hash text,
  p_editor_ip_display text
)
returns public.reports
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_report public.reports;
  v_exists boolean;
begin
  if v_editor_user_id is null and p_editor_ip_hash is null then
    raise exception '신고자 식별 정보(로그인 사용자 또는 IP 해시)가 필요합니다.';
  end if;
  if p_target_type not in ('document', 'discussion_comment') then
    raise exception '알 수 없는 신고 대상입니다: %', p_target_type;
  end if;
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception '신고 사유를 입력해 주세요.';
  end if;

  if p_target_type = 'document' then
    select exists(select 1 from public.documents where id = p_target_id) into v_exists;
  else
    select exists(select 1 from public.discussion_comments where id = p_target_id) into v_exists;
  end if;
  if not v_exists then
    raise exception '신고 대상을 찾을 수 없습니다.';
  end if;

  insert into public.reports (target_type, target_id, reason, reporter_user_id, reporter_ip_hash, reporter_ip_display)
  values (
    p_target_type, p_target_id, p_reason, v_editor_user_id,
    case when v_editor_user_id is null then p_editor_ip_hash else null end,
    case when v_editor_user_id is null then p_editor_ip_display else null end
  )
  returning * into v_report;

  return v_report;
end;
$$;

grant execute on function public.create_report(text, uuid, text, text, text) to anon, authenticated;
