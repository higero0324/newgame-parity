-- Friends feature schema for HISEI
-- Run this in Supabase SQL editor.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  friend_id text unique not null,
  display_name text not null default '',
  status_message text not null default '',
  icon_text text not null default '',
  icon_image_data_url text not null default '',
  icon_frame_id text not null default '',
  profile_card_template text not null default 'classic',
  achievement_stats jsonb not null default '{}'::jsonb,
  unlocked_title_ids text[] not null default '{}',
  equipped_title_ids text[] not null default '{}',
  starred_match_ids uuid[] not null default '{}',
  featured_match_ids uuid[] not null default '{}',
  match_names jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists starred_match_ids uuid[] not null default '{}';

alter table public.profiles
  add column if not exists profile_card_template text not null default 'classic';

alter table public.profiles
  add column if not exists achievement_stats jsonb not null default '{}'::jsonb;

alter table public.profiles
  add column if not exists unlocked_title_ids text[] not null default '{}';

alter table public.profiles
  add column if not exists equipped_title_ids text[] not null default '{}';

alter table public.profiles
  add column if not exists icon_frame_id text not null default '';

create table if not exists public.friend_requests (
  id uuid primary key default gen_random_uuid(),
  from_user_id uuid not null references auth.users(id) on delete cascade,
  to_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now()
);

create unique index if not exists friend_requests_unique_pair_pending
  on public.friend_requests(from_user_id, to_user_id, status)
  where status = 'pending';

create table if not exists public.friendships (
  user_low_id uuid not null references auth.users(id) on delete cascade,
  user_high_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_low_id, user_high_id),
  check (user_low_id < user_high_id)
);

alter table public.profiles enable row level security;
alter table public.friend_requests enable row level security;
alter table public.friendships enable row level security;

drop policy if exists profiles_select_all_auth on public.profiles;
create policy profiles_select_all_auth
on public.profiles
for select
to authenticated
using (true);

drop policy if exists profiles_upsert_self on public.profiles;
create policy profiles_upsert_self
on public.profiles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists friend_requests_insert_self on public.friend_requests;
create policy friend_requests_insert_self
on public.friend_requests
for insert
to authenticated
with check (auth.uid() = from_user_id and from_user_id <> to_user_id);

drop policy if exists friend_requests_select_involved on public.friend_requests;
create policy friend_requests_select_involved
on public.friend_requests
for select
to authenticated
using (auth.uid() = from_user_id or auth.uid() = to_user_id);

drop policy if exists friend_requests_update_receiver on public.friend_requests;
create policy friend_requests_update_receiver
on public.friend_requests
for update
to authenticated
using (auth.uid() = to_user_id)
with check (auth.uid() = to_user_id);

drop policy if exists friendships_select_involved on public.friendships;
create policy friendships_select_involved
on public.friendships
for select
to authenticated
using (auth.uid() = user_low_id or auth.uid() = user_high_id);

drop policy if exists friendships_upsert_involved on public.friendships;
create policy friendships_upsert_involved
on public.friendships
for insert
to authenticated
with check (auth.uid() = user_low_id or auth.uid() = user_high_id);

drop policy if exists friendships_delete_involved on public.friendships;
create policy friendships_delete_involved
on public.friendships
for delete
to authenticated
using (auth.uid() = user_low_id or auth.uid() = user_high_id);

-- Optional: allow friends to replay each other's matches and moves.
-- If your matches/moves already have RLS, add these policies:
drop policy if exists matches_select_owner_or_friend on public.matches;
create policy matches_select_owner_or_friend
on public.matches
for select
to authenticated
using (
  auth.uid() = user_id
  or exists (
    select 1
    from public.friendships f
    where
      f.user_low_id = least(auth.uid(), user_id)
      and f.user_high_id = greatest(auth.uid(), user_id)
  )
);

drop policy if exists moves_select_owner_or_friend on public.moves;
create policy moves_select_owner_or_friend
on public.moves
for select
to authenticated
using (
  exists (
    select 1
    from public.matches m
    where
      m.id = moves.match_id
      and (
        m.user_id = auth.uid()
        or exists (
          select 1
          from public.friendships f
          where
            f.user_low_id = least(auth.uid(), m.user_id)
            and f.user_high_id = greatest(auth.uid(), m.user_id)
        )
      )
  )
);
