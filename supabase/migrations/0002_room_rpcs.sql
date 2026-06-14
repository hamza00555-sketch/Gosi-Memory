-- Room data-operations as SECURITY DEFINER RPCs.
--
-- These never trust a client-supplied player id: identity is always auth.uid().
-- Each returns the canonical room as JSON shaped exactly like the TS `Room`
-- type, so the client maps it with an identity cast.

-- Build the Room JSON (members + teams) for a room id.
create or replace function room_json(p_room uuid)
returns jsonb as $$
  select jsonb_build_object(
    'id', r.id,
    'code', r.code,
    'mode', r.mode,
    'status', r.status,
    'hostId', r.host_id,
    'gameId', r.game_id,
    'createdAt', (extract(epoch from r.created_at) * 1000)::bigint,
    'updatedAt', (extract(epoch from r.updated_at) * 1000)::bigint,
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'playerId', m.player_id,
        'displayName', m.display_name,
        'avatarUrl', m.avatar_url,
        'isReady', m.is_ready,
        'isConnected', m.is_connected,
        'teamId', m.team_id,
        'lastSeenAt', (extract(epoch from m.last_seen_at) * 1000)::bigint
      ) order by m.last_seen_at)
      from room_members m where m.room_id = r.id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(distinct jsonb_build_object('id', t.team_id, 'name', t.team_id, 'memberIds', '[]'::jsonb))
      from room_members t where t.room_id = r.id and t.team_id is not null
    ), '[]'::jsonb)
  )
  from rooms r where r.id = p_room;
$$ language sql stable security definer;

create or replace function get_room(p_room_id uuid)
returns jsonb as $$
  select room_json(p_room_id);
$$ language sql stable security definer;

-- Generate a unique 6-char room code (retries on collision).
create or replace function gen_room_code() returns text as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where rooms.code = code);
  end loop;
  return code;
end;
$$ language plpgsql;

create or replace function create_room(p_mode text, p_host jsonb, p_difficulty text default null)
returns jsonb as $$
declare
  v_uid uuid := auth.uid();
  v_room uuid;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  insert into profiles (id, display_name, avatar_url)
  values (v_uid, coalesce(p_host->>'displayName', 'لاعب'), p_host->>'avatarUrl')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into rooms (code, mode, host_id)
  values (gen_room_code(), p_mode, v_uid)
  returning id into v_room;

  insert into room_members (room_id, player_id, display_name, avatar_url, is_ready)
  values (v_room, v_uid, coalesce(p_host->>'displayName', 'لاعب'), p_host->>'avatarUrl', false);

  return room_json(v_room);
end;
$$ language plpgsql security definer;

create or replace function join_room(p_code text, p_player jsonb)
returns jsonb as $$
declare
  v_uid uuid := auth.uid();
  v_room rooms;
  v_humans int;
  v_cap int;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_room from rooms where code = upper(p_code) for update;
  if not found then raise exception 'ROOM_NOT_FOUND'; end if;
  if v_room.status in ('in_progress', 'completed') then raise exception 'ALREADY_STARTED'; end if;

  v_cap := case v_room.mode when 'one_vs_one' then 2 when 'two_vs_two' then 4 else 1 end;
  select count(*) into v_humans from room_members where room_id = v_room.id;
  if v_humans >= v_cap and not exists (
    select 1 from room_members where room_id = v_room.id and player_id = v_uid
  ) then
    raise exception 'ROOM_FULL';
  end if;

  insert into profiles (id, display_name, avatar_url)
  values (v_uid, coalesce(p_player->>'displayName', 'لاعب'), p_player->>'avatarUrl')
  on conflict (id) do update set display_name = excluded.display_name;

  insert into room_members (room_id, player_id, display_name, avatar_url)
  values (v_room.id, v_uid, coalesce(p_player->>'displayName', 'لاعب'), p_player->>'avatarUrl')
  on conflict (room_id, player_id) do update set is_connected = true, last_seen_at = now();

  return room_json(v_room.id);
end;
$$ language plpgsql security definer;

create or replace function set_ready(p_room_id uuid, p_player_id uuid, p_is_ready boolean)
returns jsonb as $$
declare
  v_uid uuid := auth.uid();
  v_humans int;
  v_ready int;
  v_cap int;
  v_mode text;
begin
  if v_uid is null then raise exception 'AUTH_REQUIRED'; end if;

  update room_members set is_ready = p_is_ready
   where room_id = p_room_id and player_id = v_uid;

  select mode into v_mode from rooms where id = p_room_id;
  v_cap := case v_mode when 'one_vs_one' then 2 when 'two_vs_two' then 4 else 1 end;
  select count(*) into v_humans from room_members where room_id = p_room_id;
  select count(*) into v_ready from room_members where room_id = p_room_id and is_ready;

  update rooms
     set status = case when v_humans >= v_cap and v_ready = v_humans then 'ready' else 'waiting' end
   where id = p_room_id and status in ('waiting', 'ready');

  return room_json(p_room_id);
end;
$$ language plpgsql security definer;

create or replace function leave_room(p_room_id uuid, p_player_id uuid)
returns void as $$
declare
  v_uid uuid := auth.uid();
begin
  delete from room_members where room_id = p_room_id and player_id = v_uid;
  -- Reassign host or delete empty room.
  if not exists (select 1 from room_members where room_id = p_room_id) then
    delete from rooms where id = p_room_id;
  else
    update rooms set host_id = (
      select player_id from room_members where room_id = p_room_id order by last_seen_at limit 1
    ) where id = p_room_id and host_id = v_uid;
  end if;
end;
$$ language plpgsql security definer;

create or replace function touch_presence(p_room_id uuid, p_player_id uuid)
returns void as $$
  update room_members set is_connected = true, last_seen_at = now()
   where room_id = p_room_id and player_id = auth.uid();
$$ language sql security definer;
