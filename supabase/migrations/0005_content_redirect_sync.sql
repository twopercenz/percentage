-- P2: 파서 10단계 "#redirect 문서명" 문법을 create_revision()과 동기화한다.
--
-- 0004에서는 이동(move_document)만 documents.redirect_target을 직접 세팅했고,
-- 일반 저장(create_revision)은 본문에 "#redirect 문서명"을 적어도 이 컬럼을
-- 건드리지 않았다(그 시점엔 파서가 이 문법을 몰랐다). 이제 저장할 때마다 본문
-- 첫 줄을 검사해서:
--   - "#redirect 문서명"이면 redirect_target을 그 값으로 세팅하고,
--   - 아니면(사용자가 넘겨주기 줄을 지우고 실제 내용을 썼다면) null로 되돌린다.
-- lib/namumark/parser.ts의 extractRedirectTarget()과 같은 규칙(첫 줄, "#redirect " 뒤
-- 나머지를 트림)을 SQL로 그대로 옮긴 것이라, 두 쪽이 어긋나지 않게 정규식을 맞춰야 한다.

drop function if exists public.create_revision(text, text, text, text, text, text);

create function public.create_revision(
  p_namespace text,
  p_title text,
  p_content text,
  p_comment text,
  p_editor_ip_hash text,
  p_editor_ip_display text
)
returns public.revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_full_title text;
  v_document public.documents;
  v_prev_revision public.revisions;
  v_next_rev_number integer;
  v_type text;
  v_byte_size integer;
  v_byte_diff integer;
  v_revision public.revisions;
  v_first_line text;
  v_redirect_target text;
begin
  if v_editor_user_id is null and p_editor_ip_hash is null then
    raise exception '편집자 식별 정보(로그인 사용자 또는 IP 해시)가 필요합니다.';
  end if;

  v_full_title := case
    when p_namespace = '문서' then p_title
    else p_namespace || ':' || p_title
  end;

  v_first_line := split_part(p_content, E'\n', 1);
  v_redirect_target := (regexp_match(v_first_line, '^#redirect\s+(.+?)\s*$'))[1];

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
    v_editor_user_id,
    case when v_editor_user_id is null then p_editor_ip_hash else null end,
    case when v_editor_user_id is null then p_editor_ip_display else null end,
    v_byte_size, v_byte_diff
  )
  returning * into v_revision;

  update public.documents
    set current_revision_id = v_revision.id, updated_at = now(), redirect_target = v_redirect_target
    where id = v_document.id;

  return v_revision;
end;
$$;

grant execute on function public.create_revision(text, text, text, text, text, text) to anon, authenticated;

-- 되돌리기도 같은 불변식을 지켜야 한다: 되돌린 리비전의 첫 줄이 "#redirect 문서명"이면
-- redirect_target을 복원하고, 아니면(넘겨주기가 아니었던 옛 리비전으로 되돌리면) 지운다.
drop function if exists public.revert_revision(uuid, uuid, text, text, text);

create function public.revert_revision(
  p_document_id uuid,
  p_target_revision_id uuid,
  p_comment text,
  p_editor_ip_hash text,
  p_editor_ip_display text
)
returns public.revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_document public.documents;
  v_target public.revisions;
  v_prev_revision public.revisions;
  v_next_rev_number integer;
  v_byte_size integer;
  v_byte_diff integer;
  v_revision public.revisions;
  v_first_line text;
  v_redirect_target text;
begin
  if v_editor_user_id is null and p_editor_ip_hash is null then
    raise exception '편집자 식별 정보(로그인 사용자 또는 IP 해시)가 필요합니다.';
  end if;

  select * into v_document from public.documents where id = p_document_id;
  if v_document.id is null then
    raise exception '문서를 찾을 수 없습니다.';
  end if;

  select * into v_target from public.revisions
    where id = p_target_revision_id and document_id = p_document_id;
  if v_target.id is null then
    raise exception '되돌릴 리비전을 찾을 수 없습니다.';
  end if;

  select * into v_prev_revision
    from public.revisions
    where document_id = p_document_id
    order by rev_number desc
    limit 1;

  v_next_rev_number := coalesce(v_prev_revision.rev_number, 0) + 1;
  v_byte_size := octet_length(v_target.content);
  v_byte_diff := v_byte_size - coalesce(v_prev_revision.byte_size, 0);

  v_first_line := split_part(v_target.content, E'\n', 1);
  v_redirect_target := (regexp_match(v_first_line, '^#redirect\s+(.+?)\s*$'))[1];

  insert into public.revisions (
    document_id, rev_number, content, comment, type,
    editor_user_id, editor_ip_hash, editor_ip_display,
    byte_size, byte_diff
  )
  values (
    p_document_id, v_next_rev_number, v_target.content, p_comment, 'revert',
    v_editor_user_id,
    case when v_editor_user_id is null then p_editor_ip_hash else null end,
    case when v_editor_user_id is null then p_editor_ip_display else null end,
    v_byte_size, v_byte_diff
  )
  returning * into v_revision;

  update public.documents
    set current_revision_id = v_revision.id, is_deleted = false, updated_at = now(),
        redirect_target = v_redirect_target
    where id = p_document_id;

  return v_revision;
end;
$$;

grant execute on function public.revert_revision(uuid, uuid, text, text, text) to anon, authenticated;
