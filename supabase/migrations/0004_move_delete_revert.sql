-- P2: 문서 이동·삭제·되돌리기.
--
-- 겸사겸사 create_revision()의 인증 스푸핑 허점을 막는다: 지금까지는 클라이언트가
-- p_editor_user_id를 임의의 uuid로 넘길 수 있어서, RPC 이름만 알면 다른 사용자로
-- 위장한 리비전을 만들 수 있었다(SECURITY DEFINER라 RLS를 우회하는 함수인데
-- 인자를 그대로 믿었음). 이제 editor_user_id는 항상 auth.uid()(요청의 세션에서
-- 서버가 검증한 값)에서만 가져오고, 클라이언트가 이를 지정할 방법을 없앤다.
-- 이동·삭제는 로그인 사용자만 가능해야 하므로(§7) 이 스푸핑 차단이 특히 중요하다.

drop function if exists public.create_revision(text, text, text, text, uuid, text, text);

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
begin
  if v_editor_user_id is null and p_editor_ip_hash is null then
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
    v_editor_user_id,
    case when v_editor_user_id is null then p_editor_ip_hash else null end,
    case when v_editor_user_id is null then p_editor_ip_display else null end,
    v_byte_size, v_byte_diff
  )
  returning * into v_revision;

  update public.documents
    set current_revision_id = v_revision.id, updated_at = now()
    where id = v_document.id;

  return v_revision;
end;
$$;

grant execute on function public.create_revision(text, text, text, text, text, text) to anon, authenticated;

-- 문서 삭제: 로그인 사용자만. 실제로는 is_deleted=true로 표시하고 'delete' 타입
-- 리비전을 추가할 뿐, 기존 리비전은 그대로 남아 역사에서 계속 볼 수 있다.
create function public.delete_document(
  p_full_title text,
  p_comment text
)
returns public.revisions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_document public.documents;
  v_prev_revision public.revisions;
  v_next_rev_number integer;
  v_revision public.revisions;
begin
  if v_editor_user_id is null then
    raise exception '삭제는 로그인한 사용자만 할 수 있습니다.';
  end if;

  select * into v_document from public.documents where full_title = p_full_title;
  if v_document.id is null then
    raise exception '문서를 찾을 수 없습니다.';
  end if;
  if v_document.is_deleted then
    raise exception '이미 삭제된 문서입니다.';
  end if;

  select * into v_prev_revision
    from public.revisions
    where document_id = v_document.id
    order by rev_number desc
    limit 1;

  v_next_rev_number := coalesce(v_prev_revision.rev_number, 0) + 1;

  insert into public.revisions (
    document_id, rev_number, content, comment, type, editor_user_id, byte_size, byte_diff
  )
  values (
    v_document.id, v_next_rev_number, '', p_comment, 'delete',
    v_editor_user_id, 0, 0 - coalesce(v_prev_revision.byte_size, 0)
  )
  returning * into v_revision;

  update public.documents
    set current_revision_id = v_revision.id, is_deleted = true, updated_at = now()
    where id = v_document.id;

  return v_revision;
end;
$$;

grant execute on function public.delete_document(text, text) to authenticated;

-- 되돌리기: 옛 리비전 내용을 그대로 새 리비전으로 다시 만든다(§7 정책엔 명시가
-- 없어 edit과 같은 등급으로 취급 - 비로그인 IP도 가능). 삭제된 문서를 되돌리면
-- 복구된다.
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
    set current_revision_id = v_revision.id, is_deleted = false, updated_at = now()
    where id = p_document_id;

  return v_revision;
end;
$$;

grant execute on function public.revert_revision(uuid, uuid, text, text, text) to anon, authenticated;

-- 이동: 로그인 사용자만. 문서 자체를 새 제목으로 옮기고(내용은 그대로, 'move' 리비전
-- 추가), 옛 제목 자리에는 새 제목으로 안내하는 넘겨주기(redirect_target) 문서를
-- 남긴다. 넘겨주기 문서의 본문에 "#redirect 새제목"을 적어두지만, #redirect 첫 줄
-- 구문 파싱은 파서 7~10단계(아직 미구현) 대상이라 지금은 문서 보기 페이지가
-- redirect_target 컬럼을 직접 보고 이동을 따라간다.
create function public.move_document(
  p_from_full_title text,
  p_to_namespace text,
  p_to_title text,
  p_comment text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor_user_id uuid := auth.uid();
  v_document public.documents;
  v_prev_revision public.revisions;
  v_to_full_title text;
  v_stub_document public.documents;
  v_next_rev_number integer;
  v_new_revision public.revisions;
  v_redirect_content text;
begin
  if v_editor_user_id is null then
    raise exception '이동은 로그인한 사용자만 할 수 있습니다.';
  end if;

  select * into v_document from public.documents where full_title = p_from_full_title;
  if v_document.id is null then
    raise exception '문서를 찾을 수 없습니다.';
  end if;
  if v_document.is_deleted then
    raise exception '삭제된 문서는 이동할 수 없습니다.';
  end if;

  v_to_full_title := case
    when p_to_namespace = '문서' then p_to_title
    else p_to_namespace || ':' || p_to_title
  end;

  if v_to_full_title = p_from_full_title then
    raise exception '같은 제목으로는 이동할 수 없습니다.';
  end if;

  select * into v_prev_revision
    from public.revisions
    where document_id = v_document.id
    order by rev_number desc
    limit 1;

  -- 문서 자체를 새 제목으로 옮긴다. v_document는 update 이전 스냅샷이라
  -- 아래에서 옛 namespace/title이 계속 필요할 때 그대로 쓸 수 있다.
  update public.documents
    set namespace = p_to_namespace, title = p_to_title, full_title = v_to_full_title, updated_at = now()
    where id = v_document.id;

  v_next_rev_number := coalesce(v_prev_revision.rev_number, 0) + 1;

  insert into public.revisions (
    document_id, rev_number, content, comment, type, editor_user_id, byte_size, byte_diff
  )
  values (
    v_document.id, v_next_rev_number, coalesce(v_prev_revision.content, ''),
    coalesce(nullif(p_comment, ''), p_from_full_title || ' -> ' || v_to_full_title),
    'move', v_editor_user_id, coalesce(v_prev_revision.byte_size, 0), 0
  )
  returning * into v_new_revision;

  update public.documents set current_revision_id = v_new_revision.id where id = v_document.id;

  -- 옛 제목 자리에 넘겨주기 문서를 만든다.
  insert into public.documents (namespace, title, full_title, redirect_target, is_deleted)
  values (v_document.namespace, v_document.title, p_from_full_title, v_to_full_title, false)
  returning * into v_stub_document;

  v_redirect_content := '#redirect ' || v_to_full_title;

  insert into public.revisions (
    document_id, rev_number, content, comment, type, editor_user_id, byte_size, byte_diff
  )
  values (
    v_stub_document.id, 1, v_redirect_content, '문서 이동으로 생성된 넘겨주기',
    'move', v_editor_user_id, octet_length(v_redirect_content), octet_length(v_redirect_content)
  )
  returning * into v_new_revision;

  update public.documents set current_revision_id = v_new_revision.id where id = v_stub_document.id;

  return v_to_full_title;
end;
$$;

grant execute on function public.move_document(text, text, text, text) to authenticated;
