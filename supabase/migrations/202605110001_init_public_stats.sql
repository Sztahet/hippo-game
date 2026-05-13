begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

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

create index if not exists player_daily_stats_recent_idx
  on public.player_daily_stats (player_id, stat_date desc);

create index if not exists player_word_progress_due_idx
  on public.player_word_progress (player_id, next_review);

create index if not exists player_public_stats_ranking_idx
  on public.player_public_stats (is_public, current_streak desc, mastered_words desc, total_sessions desc, updated_at desc);

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

comment on table public.players is 'Identity layer for Supabase-backed player stats. Can later be linked to auth.users.';
comment on table public.player_settings is 'Imported local app settings such as active CEFR levels and ignored word IDs.';
comment on table public.player_daily_stats is 'Per-day aggregate stats imported from localStorage dailyStats.';
comment on table public.player_word_progress is 'Per-word SRS progress imported from localStorage progress.';
comment on table public.player_public_stats is 'Public leaderboard-safe snapshot derived from raw stats tables.';

commit;