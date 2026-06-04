-- 관리자 전용 댓글/답글 삭제 기능
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 RUN 하세요. (이미 supabase_schema.sql은 실행한 상태 가정)

-- 1) 관리자 비밀번호 보관 테이블
--    RLS는 켜되 정책을 만들지 않음 → publishable key로는 읽기/쓰기 모두 불가.
--    아래 security definer 함수(서버 권한)에서만 접근한다.
create table if not exists public.admin_config (
  id       int  primary key default 1,
  password text not null,
  constraint admin_config_single check (id = 1)
);
alter table public.admin_config enable row level security;

-- 2) 비밀번호 검증 (관리자 모드 진입용)
create or replace function public.verify_admin(admin_secret text)
returns boolean
language sql security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_config where id = 1 and password = admin_secret
  );
$$;

-- 3) 댓글 삭제 (비번 일치 시에만 / 답글은 FK on delete cascade 로 함께 삭제)
create or replace function public.delete_comment(row_id uuid, admin_secret text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.verify_admin(admin_secret) then
    return false;
  end if;
  delete from public.comments where id = row_id;
  return true;
end;
$$;

-- 4) 답글 삭제 (비번 일치 시에만)
create or replace function public.delete_reply(row_id uuid, admin_secret text)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.verify_admin(admin_secret) then
    return false;
  end if;
  delete from public.replies where id = row_id;
  return true;
end;
$$;

grant execute on function public.verify_admin(text)         to anon, authenticated;
grant execute on function public.delete_comment(uuid, text) to anon, authenticated;
grant execute on function public.delete_reply(uuid, text)   to anon, authenticated;

-- 5) ★ 관리자 비밀번호 설정 — 아래 주석을 풀고 '여기에_비밀번호'만 바꿔서 한 번 실행하세요.
--    이 비밀번호는 코드/깃에 올리지 말고, 대시보드에서만 실행하세요.
-- insert into public.admin_config (id, password) values (1, '여기에_비밀번호')
--   on conflict (id) do update set password = excluded.password;
