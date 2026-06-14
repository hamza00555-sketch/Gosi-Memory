-- QAWSI — initial schema, RLS, and concurrency design.
--
-- SAFETY MODEL (the important part):
-- * Clients are never trusted to compute game outcomes. They only submit
--   intent (which card, which guess) to server-side code.
-- * Every game mutation runs through ONE writer that:
--     1. locks the game row (SELECT ... FOR UPDATE),
--     2. runs the SHARED engine reducer (the same TypeScript `reduce` used on
--        the client) inside a Supabase Edge Function,
--     3. writes the new snapshot back, guarded by an optimistic `version` check.
--   The row lock makes two simultaneous moves impossible to interleave; the
--   version check makes a stale write impossible to apply. This is the safest
--   option for this game shape (low write rate, strong consistency needed).
-- * RLS below restricts reads to room members and blocks all direct writes to
--   `games`/`rooms` from clients — writes happen only via SECURITY DEFINER
--   functions / the Edge Function service role.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  avatar_url text,
  level int not null default 1,
  coins int not null default 1000,
  xp int not null default 0,
  selected_card_skin text not null default 'skin_default',
  selected_ar_set text not null default 'ar_default',
  created_at timestamptz not null default now()
);

create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  mode text not null check (mode in ('solo_ai', 'one_vs_one', 'two_vs_two')),
  status text not null default 'waiting'
    check (status in ('waiting', 'ready', 'in_progress', 'completed')),
  host_id uuid not null references profiles (id),
  game_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists room_members (
  room_id uuid not null references rooms (id) on delete cascade,
  player_id uuid not null references profiles (id),
  display_name text not null,
  avatar_url text,
  is_ready boolean not null default false,
  is_connected boolean not null default true,
  team_id text,
  last_seen_at timestamptz not null default now(),
  primary key (room_id, player_id)
);

-- The authoritative game snapshot is stored as JSONB matching the TS `Game`
-- type, so the Edge Function can hydrate -> reduce -> persist with no mapping.
create table if not exists games (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms (id) on delete cascade,
  status text not null default 'in_progress',
  version int not null default 0,
  state jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_room_members_player on room_members (player_id);
create index if not exists idx_games_room on games (room_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function touch_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_rooms_updated on rooms;
create trigger trg_rooms_updated before update on rooms
  for each row execute function touch_updated_at();

drop trigger if exists trg_games_updated on games;
create trigger trg_games_updated before update on games
  for each row execute function touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table rooms enable row level security;
alter table room_members enable row level security;
alter table games enable row level security;

-- Profiles: a user can read any profile (names/avatars) but write only their own.
create policy "profiles_read" on profiles for select using (true);
create policy "profiles_self_update" on profiles for update
  using (auth.uid() = id) with check (auth.uid() = id);
create policy "profiles_self_insert" on profiles for insert
  with check (auth.uid() = id);

-- Helper: is the current user a member of a room?
create or replace function is_room_member(p_room uuid) returns boolean as $$
  select exists (
    select 1 from room_members m
    where m.room_id = p_room and m.player_id = auth.uid()
  );
$$ language sql stable security definer;

-- Rooms/members/games: readable by members; NO direct client writes.
-- Writes are performed by SECURITY DEFINER RPCs and the service-role Edge Fn.
create policy "rooms_read_members" on rooms for select
  using (is_room_member(id) or host_id = auth.uid());

create policy "members_read" on room_members for select
  using (is_room_member(room_id));

create policy "games_read_members" on games for select
  using (is_room_member(room_id));

-- ---------------------------------------------------------------------------
-- Concurrency-safe lock helper used by the Edge Function (game-action).
-- Returns the locked game row; the function then reduces and updates it.
-- ---------------------------------------------------------------------------
create or replace function lock_game(p_game uuid)
returns games as $$
  select * from games where id = p_game for update;
$$ language sql;

-- ---------------------------------------------------------------------------
-- Optimistic write used by the Edge Function. Rejects stale versions so two
-- concurrent reducers can never clobber each other.
-- ---------------------------------------------------------------------------
create or replace function commit_game(
  p_game uuid,
  p_expected_version int,
  p_state jsonb,
  p_status text
) returns games as $$
declare
  result games;
begin
  update games
     set state = p_state,
         status = p_status,
         version = p_expected_version + 1
   where id = p_game and version = p_expected_version
   returning * into result;

  if not found then
    raise exception 'STALE_VERSION' using errcode = '40001';
  end if;

  return result;
end;
$$ language plpgsql security definer;
