begin;

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

  with normalized_daily_stats as (
    select distinct on (normalized.stat_date)
      normalized.stat_date
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
  delete from public.player_daily_stats as stats
  where stats.player_id = target_player_id
    and not exists (
      select 1
      from normalized_daily_stats
      where normalized_daily_stats.stat_date = stats.stat_date
    );

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

  with normalized_word_progress as (
    select distinct on (normalized.word_id)
      normalized.word_id
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
  delete from public.player_word_progress as word_progress
  where word_progress.player_id = target_player_id
    and not exists (
      select 1
      from normalized_word_progress
      where normalized_word_progress.word_id = word_progress.word_id
    );

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

comment on function public.sync_player_state_from_auth(jsonb) is 'Replaces the authenticated players settings, daily stats, and word progress with the current client snapshot, accepting both camelCase and snake_case payload keys.';

commit;