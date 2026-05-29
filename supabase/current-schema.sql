-- Canonical current-state Supabase schema snapshot.
-- Use this file to bootstrap an empty project or inspect the latest active SQL objects.
-- Historical evolution lives in supabase/migrations/.

begin;

create extension if not exists pgcrypto;

-- Core helpers
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

-- Tables
create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  handle text not null unique,
  display_name text not null,
  source text not null default 'manual-import',
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint players_handle_format check (handle ~ '^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$'),
  constraint players_display_name_length check (char_length(trim(display_name)) between 1 and 50)
);

create table if not exists public.player_settings (
  player_id uuid primary key references public.players(id) on delete cascade,
  active_levels jsonb not null default '["A1","A2"]'::jsonb,
  ignored_word_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint player_settings_active_levels_is_array check (jsonb_typeof(active_levels) = 'array'),
  constraint player_settings_ignored_word_ids_is_array check (jsonb_typeof(ignored_word_ids) = 'array')
);

create table if not exists public.player_daily_stats (
  player_id uuid not null references public.players(id) on delete cascade,
  stat_date date not null,
  sessions integer not null check (sessions > 0),
  sum_pct integer not null check (sum_pct between 0 and sessions * 100),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (player_id, stat_date)
);

create table if not exists public.player_word_progress (
  player_id uuid not null references public.players(id) on delete cascade,
  word_id integer not null check (word_id > 0),
  level smallint not null check (level between 0 and 8),
  next_review date not null,
  last_review date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (player_id, word_id),
  constraint player_word_progress_last_review_order check (last_review is null or last_review <= next_review)
);

create table if not exists public.player_public_stats (
  player_id uuid primary key references public.players(id) on delete cascade,
  handle text not null unique,
  display_name text not null,
  is_public boolean not null default true,
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  active_days integer not null default 0 check (active_days >= 0),
  total_sessions integer not null default 0 check (total_sessions >= 0),
  avg_pct_lifetime integer check (avg_pct_lifetime between 0 and 100),
  learned_words integer not null default 0 check (learned_words >= 0),
  mastered_words integer not null default 0 check (mastered_words >= 0),
  due_words integer not null default 0 check (due_words >= 0),
  last_active_on date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- Indexes
create index if not exists player_daily_stats_recent_idx
  on public.player_daily_stats (player_id, stat_date desc);

create index if not exists player_word_progress_due_idx
  on public.player_word_progress (player_id, next_review);

create index if not exists player_public_stats_ranking_idx
  on public.player_public_stats (is_public, current_streak desc, mastered_words desc, total_sessions desc, updated_at desc);

-- Public stats functions and triggers
create or replace function public.player_current_streak(target_player_id uuid)
returns integer
language sql
stable
as $$
  with ordered_days as (
    select distinct stat_date
    from public.player_daily_stats
    where player_id = target_player_id
      and stat_date <= current_date
  ),
  grouped as (
    select
      stat_date,
      (current_date - stat_date) as day_offset,
      row_number() over (order by stat_date desc) - 1 as row_offset
    from ordered_days
  )
  select coalesce(count(*), 0)::integer
  from grouped
  where day_offset = row_offset;
$$;

create or replace function public.player_best_streak(target_player_id uuid)
returns integer
language sql
stable
as $$
  with ordered_days as (
    select distinct stat_date
    from public.player_daily_stats
    where player_id = target_player_id
  ),
  grouped as (
    select
      stat_date,
      stat_date - row_number() over (order by stat_date)::integer as streak_group
    from ordered_days
  ),
  streaks as (
    select streak_group, count(*)::integer as streak_len
    from grouped
    group by streak_group
  )
  select coalesce(max(streak_len), 0)::integer
  from streaks;
$$;

create or replace function public.refresh_player_public_stats(target_player_id uuid)
returns void
language plpgsql
as $$
begin
  insert into public.player_public_stats as stats (
    player_id,
    handle,
    display_name,
    is_public,
    current_streak,
    best_streak,
    active_days,
    total_sessions,
    avg_pct_lifetime,
    learned_words,
    mastered_words,
    due_words,
    last_active_on,
    created_at,
    updated_at
  )
  select
    p.id,
    p.handle,
    p.display_name,
    p.is_public,
    public.player_current_streak(p.id),
    public.player_best_streak(p.id),
    coalesce(daily.active_days, 0),
    coalesce(daily.total_sessions, 0),
    case
      when coalesce(daily.total_sessions, 0) > 0
        then round(daily.total_pct_points::numeric / daily.total_sessions)::integer
      else null
    end,
    coalesce(progress.learned_words, 0),
    coalesce(progress.mastered_words, 0),
    coalesce(progress.due_words, 0),
    daily.last_active_on,
    timezone('utc', now()),
    timezone('utc', now())
  from public.players as p
  left join (
    select
      player_id,
      count(*)::integer as active_days,
      coalesce(sum(sessions), 0)::integer as total_sessions,
      coalesce(sum(sum_pct), 0)::integer as total_pct_points,
      max(stat_date) as last_active_on
    from public.player_daily_stats
    where player_id = target_player_id
    group by player_id
  ) as daily on daily.player_id = p.id
  left join (
    select
      player_id,
      count(*)::integer as learned_words,
      count(*) filter (where level >= 8)::integer as mastered_words,
      count(*) filter (where next_review <= current_date)::integer as due_words
    from public.player_word_progress
    where player_id = target_player_id
    group by player_id
  ) as progress on progress.player_id = p.id
  where p.id = target_player_id
  on conflict (player_id) do update
  set
    handle = excluded.handle,
    display_name = excluded.display_name,
    is_public = excluded.is_public,
    current_streak = excluded.current_streak,
    best_streak = excluded.best_streak,
    active_days = excluded.active_days,
    total_sessions = excluded.total_sessions,
    avg_pct_lifetime = excluded.avg_pct_lifetime,
    learned_words = excluded.learned_words,
    mastered_words = excluded.mastered_words,
    due_words = excluded.due_words,
    last_active_on = excluded.last_active_on,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.refresh_player_public_stats_from_player()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_player_public_stats(coalesce(new.id, old.id));
  return coalesce(new, old);
end;
$$;

create or replace function public.refresh_player_public_stats_from_child()
returns trigger
language plpgsql
as $$
begin
  perform public.refresh_player_public_stats(coalesce(new.player_id, old.player_id));
  return coalesce(new, old);
end;
$$;

-- Auth helpers and RPCs
create or replace function public.normalize_player_handle(raw_value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(lower(coalesce(raw_value, '')), '[^a-z0-9_-]+', '-', 'g'));
$$;

create or replace function public.bootstrap_player_from_auth(import_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user_id uuid := auth.uid();
  auth_claims jsonb := auth.jwt();
  auth_email text := lower(coalesce(auth_claims ->> 'email', ''));
  preferred_display_name text := nullif(trim(coalesce(
    auth_claims -> 'user_metadata' ->> 'full_name',
    auth_claims -> 'user_metadata' ->> 'name',
    split_part(auth_email, '@', 1)
  )), '');
  base_handle text := public.normalize_player_handle(split_part(auth_email, '@', 1));
  fallback_suffix text := substring(replace(current_auth_user_id::text, '-', '') from 1 for 6);
  candidate_handle text;
  linked_player_id uuid;
  player_record public.players%rowtype;
  imported_settings boolean := false;
  imported_daily_stats integer := 0;
  imported_word_progress integer := 0;
begin
  if current_auth_user_id is null then
    raise exception 'Auth required';
  end if;

  if base_handle = '' then
    base_handle := 'hippo-player';
  end if;

  if length(base_handle) < 3 then
    base_handle := 'hippo-' || fallback_suffix;
  end if;

  base_handle := left(base_handle, 31);

  select *
  into player_record
  from public.players
  where auth_user_id = current_auth_user_id
  limit 1;

  if not found then
    candidate_handle := base_handle;

    select id
    into linked_player_id
    from public.players
    where auth_user_id is null
      and handle = candidate_handle
    limit 1;

    if linked_player_id is not null then
      update public.players
      set auth_user_id = current_auth_user_id,
          display_name = coalesce(nullif(display_name, ''), preferred_display_name, 'Hippo Player'),
          source = case when source = 'manual-import' then 'linked-auth' else source end,
          updated_at = timezone('utc', now())
      where id = linked_player_id
      returning * into player_record;
    else
      while exists(select 1 from public.players where handle = candidate_handle) loop
        candidate_handle := left(base_handle, greatest(3, 31 - 1 - length(fallback_suffix))) || '-' || fallback_suffix;
        if exists(select 1 from public.players where handle = candidate_handle) then
          fallback_suffix := substring(replace(gen_random_uuid()::text, '-', '') from 1 for 6);
        end if;
      end loop;

      insert into public.players (
        auth_user_id,
        handle,
        display_name,
        source,
        is_public
      )
      values (
        current_auth_user_id,
        candidate_handle,
        coalesce(preferred_display_name, initcap(replace(base_handle, '-', ' ')), 'Hippo Player'),
        'supabase-auth',
        true
      )
      returning * into player_record;
    end if;
  elsif coalesce(trim(player_record.display_name), '') = '' and preferred_display_name is not null then
    update public.players
    set display_name = preferred_display_name,
        updated_at = timezone('utc', now())
    where id = player_record.id
    returning * into player_record;
  end if;

  if jsonb_typeof(import_payload -> 'settings') = 'object' then
    insert into public.player_settings (
      player_id,
      active_levels,
      ignored_word_ids
    )
    values (
      player_record.id,
      coalesce(import_payload #> '{settings,activeLevels}', '["A1","A2"]'::jsonb),
      coalesce(import_payload #> '{settings,ignoredWordIds}', '[]'::jsonb)
    )
    on conflict (player_id) do update
    set active_levels = excluded.active_levels,
        ignored_word_ids = excluded.ignored_word_ids,
        updated_at = timezone('utc', now());

    imported_settings := true;
  end if;

  if jsonb_typeof(import_payload -> 'dailyStats') = 'array' then
    insert into public.player_daily_stats (
      player_id,
      stat_date,
      sessions,
      sum_pct
    )
    select
      player_record.id,
      row_data.stat_date,
      row_data.sessions,
      row_data.sum_pct
    from jsonb_to_recordset(import_payload -> 'dailyStats') as row_data(
      stat_date date,
      sessions integer,
      sum_pct integer
    )
    where row_data.stat_date is not null
      and row_data.sessions > 0
      and row_data.sum_pct between 0 and row_data.sessions * 100
    on conflict (player_id, stat_date) do update
    set sessions = excluded.sessions,
        sum_pct = excluded.sum_pct,
        updated_at = timezone('utc', now());

    get diagnostics imported_daily_stats = row_count;
  end if;

  if jsonb_typeof(import_payload -> 'wordProgress') = 'array' then
    insert into public.player_word_progress (
      player_id,
      word_id,
      level,
      next_review,
      last_review
    )
    select
      player_record.id,
      row_data.word_id,
      row_data.level,
      row_data.next_review,
      row_data.last_review
    from jsonb_to_recordset(import_payload -> 'wordProgress') as row_data(
      word_id integer,
      level smallint,
      next_review date,
      last_review date
    )
    where row_data.word_id > 0
      and row_data.level between 0 and 8
      and row_data.next_review is not null
      and (row_data.last_review is null or row_data.last_review <= row_data.next_review)
    on conflict (player_id, word_id) do update
    set level = excluded.level,
        next_review = excluded.next_review,
        last_review = excluded.last_review,
        updated_at = timezone('utc', now());

    get diagnostics imported_word_progress = row_count;
  end if;

  perform public.refresh_player_public_stats(player_record.id);

  return jsonb_build_object(
    'playerId', player_record.id,
    'handle', player_record.handle,
    'displayName', player_record.display_name,
    'importedSettings', imported_settings,
    'importedDailyStats', imported_daily_stats,
    'importedWordProgress', imported_word_progress,
    'importVersion', coalesce(import_payload ->> 'version', null)
  );
end;
$$;

create or replace function public.get_my_player_snapshot()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user_id uuid := auth.uid();
  target_player_id uuid;
begin
  if current_auth_user_id is null then
    raise exception 'Auth required';
  end if;

  select players.id
  into target_player_id
  from public.players as players
  where players.auth_user_id = current_auth_user_id
  limit 1;

  if target_player_id is null then
    return jsonb_build_object(
      'playerId', null,
      'settings', null,
      'dailyStats', '[]'::jsonb,
      'wordProgress', '[]'::jsonb
    );
  end if;

  return jsonb_build_object(
    'playerId', target_player_id,
    'settings', (
      select jsonb_build_object(
        'activeLevels', settings.active_levels,
        'ignoredWordIds', settings.ignored_word_ids
      )
      from public.player_settings as settings
      where settings.player_id = target_player_id
    ),
    'dailyStats', coalesce((
      select jsonb_agg(jsonb_build_object(
        'statDate', stats.stat_date,
        'sessions', stats.sessions,
        'sumPct', stats.sum_pct
      ) order by stats.stat_date asc)
      from public.player_daily_stats as stats
      where stats.player_id = target_player_id
    ), '[]'::jsonb),
    'wordProgress', coalesce((
      select jsonb_agg(jsonb_build_object(
        'wordId', progress.word_id,
        'level', progress.level,
        'nextReview', progress.next_review,
        'lastReview', progress.last_review
      ) order by progress.word_id asc)
      from public.player_word_progress as progress
      where progress.player_id = target_player_id
    ), '[]'::jsonb)
  );
end;
$$;

create or replace function public.sync_player_state_from_auth(state_payload jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_auth_user_id uuid := auth.uid();
  bootstrap_result jsonb;
  target_player_id uuid;
  settings_payload jsonb := case
    when jsonb_typeof(state_payload -> 'settings') = 'object' then state_payload -> 'settings'
    else '{}'::jsonb
  end;
  daily_stats_payload jsonb := case
    when jsonb_typeof(state_payload -> 'dailyStats') = 'array' then state_payload -> 'dailyStats'
    else '[]'::jsonb
  end;
  word_progress_payload jsonb := case
    when jsonb_typeof(state_payload -> 'wordProgress') = 'array' then state_payload -> 'wordProgress'
    else '[]'::jsonb
  end;
  synced_daily_stats integer := 0;
  synced_word_progress integer := 0;
  raw_daily_stats_count integer := 0;
  raw_word_progress_count integer := 0;
begin
  if current_auth_user_id is null then
    raise exception 'Auth required';
  end if;

  raw_daily_stats_count := jsonb_array_length(daily_stats_payload);
  raw_word_progress_count := jsonb_array_length(word_progress_payload);

  bootstrap_result := public.bootstrap_player_from_auth('{}'::jsonb);
  target_player_id := nullif(bootstrap_result ->> 'playerId', '')::uuid;

  if target_player_id is null then
    raise exception 'Player bootstrap failed';
  end if;

  insert into public.player_settings (
    player_id,
    active_levels,
    ignored_word_ids
  )
  values (
    target_player_id,
    coalesce(
      case
        when jsonb_typeof(settings_payload -> 'active_levels') = 'array' then settings_payload -> 'active_levels'
        when jsonb_typeof(settings_payload -> 'activeLevels') = 'array' then settings_payload -> 'activeLevels'
      end,
      '["A1","A2"]'::jsonb
    ),
    coalesce(
      case
        when jsonb_typeof(settings_payload -> 'ignored_word_ids') = 'array' then settings_payload -> 'ignored_word_ids'
        when jsonb_typeof(settings_payload -> 'ignoredWordIds') = 'array' then settings_payload -> 'ignoredWordIds'
      end,
      '[]'::jsonb
    )
  )
  on conflict (player_id) do update
  set active_levels = excluded.active_levels,
      ignored_word_ids = excluded.ignored_word_ids,
      updated_at = timezone('utc', now());

  with normalized_daily_stats as (
    select distinct on (normalized.stat_date)
      normalized.stat_date,
      normalized.sessions,
      normalized.sum_pct
    from (
      select
        coalesce(
          nullif(row_item ->> 'stat_date', '')::date,
          nullif(row_item ->> 'statDate', '')::date
        ) as stat_date,
        nullif(row_item ->> 'sessions', '')::integer as sessions,
        coalesce(
          nullif(row_item ->> 'sum_pct', '')::integer,
          nullif(row_item ->> 'sumPct', '')::integer
        ) as sum_pct
      from jsonb_array_elements(daily_stats_payload) as row_item
    ) as normalized
    where normalized.stat_date is not null
      and normalized.sessions > 0
      and normalized.sum_pct between 0 and normalized.sessions * 100
    order by normalized.stat_date, normalized.sessions desc, normalized.sum_pct desc
  )
  select count(*)
  into synced_daily_stats
  from normalized_daily_stats;

  if raw_daily_stats_count > 0 and synced_daily_stats = 0 then
    raise exception 'Invalid dailyStats payload';
  end if;

  with normalized_daily_stats as (
    select distinct on (normalized.stat_date)
      normalized.stat_date,
      normalized.sessions,
      normalized.sum_pct
    from (
      select
        coalesce(
          nullif(row_item ->> 'stat_date', '')::date,
          nullif(row_item ->> 'statDate', '')::date
        ) as stat_date,
        nullif(row_item ->> 'sessions', '')::integer as sessions,
        coalesce(
          nullif(row_item ->> 'sum_pct', '')::integer,
          nullif(row_item ->> 'sumPct', '')::integer
        ) as sum_pct
      from jsonb_array_elements(daily_stats_payload) as row_item
    ) as normalized
    where normalized.stat_date is not null
      and normalized.sessions > 0
      and normalized.sum_pct between 0 and normalized.sessions * 100
    order by normalized.stat_date, normalized.sessions desc, normalized.sum_pct desc
  )
  insert into public.player_daily_stats (
    player_id,
    stat_date,
    sessions,
    sum_pct
  )
  select
    target_player_id,
    normalized_daily_stats.stat_date,
    normalized_daily_stats.sessions,
    normalized_daily_stats.sum_pct
  from normalized_daily_stats
  on conflict (player_id, stat_date) do update
  set sessions = excluded.sessions,
      sum_pct = excluded.sum_pct,
      updated_at = timezone('utc', now());

  with normalized_word_progress as (
    select distinct on (normalized.word_id)
      normalized.word_id,
      normalized.level,
      normalized.next_review,
      normalized.last_review
    from (
      select
        coalesce(
          nullif(row_item ->> 'word_id', '')::integer,
          nullif(row_item ->> 'wordId', '')::integer
        ) as word_id,
        nullif(row_item ->> 'level', '')::smallint as level,
        coalesce(
          nullif(row_item ->> 'next_review', '')::date,
          nullif(row_item ->> 'nextReview', '')::date
        ) as next_review,
        coalesce(
          nullif(row_item ->> 'last_review', '')::date,
          nullif(row_item ->> 'lastReview', '')::date
        ) as last_review
      from jsonb_array_elements(word_progress_payload) as row_item
    ) as normalized
    where normalized.word_id > 0
      and normalized.level between 0 and 8
      and normalized.next_review is not null
      and (normalized.last_review is null or normalized.last_review <= normalized.next_review)
    order by normalized.word_id, normalized.last_review desc nulls last, normalized.level desc, normalized.next_review desc
  )
  select count(*)
  into synced_word_progress
  from normalized_word_progress;

  if raw_word_progress_count > 0 and synced_word_progress = 0 then
    raise exception 'Invalid wordProgress payload';
  end if;

  with normalized_word_progress as (
    select distinct on (normalized.word_id)
      normalized.word_id,
      normalized.level,
      normalized.next_review,
      normalized.last_review
    from (
      select
        coalesce(
          nullif(row_item ->> 'word_id', '')::integer,
          nullif(row_item ->> 'wordId', '')::integer
        ) as word_id,
        nullif(row_item ->> 'level', '')::smallint as level,
        coalesce(
          nullif(row_item ->> 'next_review', '')::date,
          nullif(row_item ->> 'nextReview', '')::date
        ) as next_review,
        coalesce(
          nullif(row_item ->> 'last_review', '')::date,
          nullif(row_item ->> 'lastReview', '')::date
        ) as last_review
      from jsonb_array_elements(word_progress_payload) as row_item
    ) as normalized
    where normalized.word_id > 0
      and normalized.level between 0 and 8
      and normalized.next_review is not null
      and (normalized.last_review is null or normalized.last_review <= normalized.next_review)
    order by normalized.word_id, normalized.last_review desc nulls last, normalized.level desc, normalized.next_review desc
  )
  insert into public.player_word_progress (
    player_id,
    word_id,
    level,
    next_review,
    last_review
  )
  select
    target_player_id,
    normalized_word_progress.word_id,
    normalized_word_progress.level,
    normalized_word_progress.next_review,
    normalized_word_progress.last_review
  from normalized_word_progress
  on conflict (player_id, word_id) do update
  set level = excluded.level,
      next_review = excluded.next_review,
      last_review = excluded.last_review,
      updated_at = timezone('utc', now());

  perform public.refresh_player_public_stats(target_player_id);

  return jsonb_build_object(
    'playerId', target_player_id,
    'syncedSettings', true,
    'syncedDailyStats', synced_daily_stats,
    'syncedWordProgress', synced_word_progress,
    'version', coalesce(state_payload ->> 'version', null)
  );
end;
$$;

-- Triggers

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
before update on public.players
for each row execute function public.set_updated_at();

drop trigger if exists player_settings_set_updated_at on public.player_settings;
create trigger player_settings_set_updated_at
before update on public.player_settings
for each row execute function public.set_updated_at();

drop trigger if exists player_daily_stats_set_updated_at on public.player_daily_stats;
create trigger player_daily_stats_set_updated_at
before update on public.player_daily_stats
for each row execute function public.set_updated_at();

drop trigger if exists player_word_progress_set_updated_at on public.player_word_progress;
create trigger player_word_progress_set_updated_at
before update on public.player_word_progress
for each row execute function public.set_updated_at();

drop trigger if exists player_public_stats_set_updated_at on public.player_public_stats;
create trigger player_public_stats_set_updated_at
before update on public.player_public_stats
for each row execute function public.set_updated_at();

drop trigger if exists players_refresh_public_stats on public.players;
create trigger players_refresh_public_stats
after insert or update on public.players
for each row execute function public.refresh_player_public_stats_from_player();

drop trigger if exists player_daily_stats_refresh_public_stats on public.player_daily_stats;
create trigger player_daily_stats_refresh_public_stats
after insert or update or delete on public.player_daily_stats
for each row execute function public.refresh_player_public_stats_from_child();

drop trigger if exists player_word_progress_refresh_public_stats on public.player_word_progress;
create trigger player_word_progress_refresh_public_stats
after insert or update or delete on public.player_word_progress
for each row execute function public.refresh_player_public_stats_from_child();

-- RLS, grants, and policies
alter table public.players enable row level security;
alter table public.player_settings enable row level security;
alter table public.player_daily_stats enable row level security;
alter table public.player_word_progress enable row level security;
alter table public.player_public_stats enable row level security;

revoke all on public.players from anon, authenticated;
revoke all on public.player_settings from anon, authenticated;
revoke all on public.player_daily_stats from anon, authenticated;
revoke all on public.player_word_progress from anon, authenticated;
revoke all on public.player_public_stats from anon, authenticated;

grant select on public.player_public_stats to anon, authenticated;

drop policy if exists player_public_stats_read_public_rows on public.player_public_stats;
create policy player_public_stats_read_public_rows
on public.player_public_stats
for select
to anon, authenticated
using (is_public = true);

-- Function grants
revoke all on function public.bootstrap_player_from_auth(jsonb) from public;
grant execute on function public.bootstrap_player_from_auth(jsonb) to authenticated;

revoke all on function public.get_my_player_snapshot() from public;
grant execute on function public.get_my_player_snapshot() to authenticated;

revoke all on function public.sync_player_state_from_auth(jsonb) from public;
grant execute on function public.sync_player_state_from_auth(jsonb) to authenticated;

-- Comments
comment on table public.players is 'Identity layer for Supabase-backed player stats. Can later be linked to auth.users.';
comment on table public.player_settings is 'Imported local app settings such as active CEFR levels and ignored word IDs.';
comment on table public.player_daily_stats is 'Per-day aggregate stats imported from localStorage dailyStats.';
comment on table public.player_word_progress is 'Per-word SRS progress imported from localStorage progress.';
comment on table public.player_public_stats is 'Public leaderboard-safe snapshot derived from raw stats tables.';

comment on function public.bootstrap_player_from_auth(jsonb) is 'Creates or links an auth-backed player row and optionally imports legacy local stats from the browser.';
comment on function public.get_my_player_snapshot() is 'Returns the authenticated players private settings, daily stats, and word progress for local hydration.';
comment on function public.sync_player_state_from_auth(jsonb) is 'Upserts the authenticated players settings, daily stats, and word progress without deleting existing rows. Accepts both camelCase and snake_case payload keys.';

commit;
