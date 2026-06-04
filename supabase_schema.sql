-- 한줄 댓글 피드 - Supabase schema
-- Supabase 대시보드 → SQL Editor에 붙여넣고 RUN 하세요.

-- 1) 댓글 테이블
create table if not exists public.comments (
  id         uuid        primary key default gen_random_uuid(),
  author     text        not null check (char_length(author) between 1 and 15),
  content    text        not null check (char_length(content) between 1 and 500),
  likes      integer     not null default 0,
  created_at timestamptz not null default now()
);

-- 2) 답글 테이블 (댓글 1 : N 답글)
create table if not exists public.replies (
  id         uuid        primary key default gen_random_uuid(),
  comment_id uuid        not null references public.comments(id) on delete cascade,
  author     text        not null check (char_length(author) between 1 and 15),
  content    text        not null check (char_length(content) between 1 and 300),
  created_at timestamptz not null default now()
);

create index if not exists replies_comment_id_idx on public.replies(comment_id);
create index if not exists comments_created_at_idx on public.comments(created_at desc);

-- 3) RLS 활성화
alter table public.comments enable row level security;
alter table public.replies  enable row level security;

-- 4) 정책: 누구나(anon) 읽기/쓰기 가능 (로그인 없는 공개 댓글 서비스)
--    수정/삭제는 막아 두고, 좋아요는 아래 RPC로만 처리한다.
create policy "comments_select" on public.comments for select to anon, authenticated using (true);
create policy "comments_insert" on public.comments for insert to anon, authenticated with check (true);
create policy "replies_select"  on public.replies  for select to anon, authenticated using (true);
create policy "replies_insert"  on public.replies  for insert to anon, authenticated with check (true);

-- 5) 좋아요 증감용 RPC (원자적 처리로 동시성 안전, 좋아요 외 컬럼은 못 건드림)
create or replace function public.increment_likes(row_id uuid)
returns integer language sql security definer set search_path = public as $$
  update public.comments set likes = likes + 1 where id = row_id returning likes;
$$;

create or replace function public.decrement_likes(row_id uuid)
returns integer language sql security definer set search_path = public as $$
  update public.comments set likes = greatest(0, likes - 1) where id = row_id returning likes;
$$;

grant execute on function public.increment_likes(uuid) to anon, authenticated;
grant execute on function public.decrement_likes(uuid) to anon, authenticated;
