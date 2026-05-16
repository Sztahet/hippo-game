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
begin
  if current_auth_user_id is null then
    raise exception 'Auth required';
  end if;

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
        when jsonb_typeof(settings_payload -> 'activeLevels') = 'array' then settings_payload -> 'activeLevels'
      end,
      '["A1","A2"]'::jsonb
    ),
    coalesce(
      case
        when jsonb_typeof(settings_payload -> 'ignoredWordIds') = 'array' then settings_payload -> 'ignoredWordIds'
      end,
      '[]'::jsonb
    )
  )
  on conflict (player_id) do update
  set active_levels = excluded.active_levels,
      ignored_word_ids = excluded.ignored_word_ids,
      updated_at = timezone('utc', now());

  select count(*)
  into synced_daily_stats
  from (
    select distinct on (row_data.stat_date)
      row_data.stat_date
    from jsonb_to_recordset(daily_stats_payload) as row_data(
      stat_date date,
      sessions integer,
      sum_pct integer
    )
    where row_data.stat_date is not null
      and row_data.sessions > 0
      and row_data.sum_pct between 0 and row_data.sessions * 100
    order by row_data.stat_date, row_data.sessions desc, row_data.sum_pct desc
  ) as validated_daily_stats;

  insert into public.player_daily_stats (
    player_id,
    stat_date,
    sessions,
    sum_pct
  )
  select
    target_player_id,
    validated_daily_stats.stat_date,
    validated_daily_stats.sessions,
    validated_daily_stats.sum_pct
  from (
    select distinct on (row_data.stat_date)
      row_data.stat_date,
      row_data.sessions,
      row_data.sum_pct
    from jsonb_to_recordset(daily_stats_payload) as row_data(
      stat_date date,
      sessions integer,
      sum_pct integer
    )
    where row_data.stat_date is not null
      and row_data.sessions > 0
      and row_data.sum_pct between 0 and row_data.sessions * 100
    order by row_data.stat_date, row_data.sessions desc, row_data.sum_pct desc
  ) as validated_daily_stats
  on conflict (player_id, stat_date) do update
  set sessions = excluded.sessions,
      sum_pct = excluded.sum_pct,
      updated_at = timezone('utc', now());

  delete from public.player_daily_stats as stats
  where stats.player_id = target_player_id
    and not exists (
      select 1
      from (
        select distinct on (row_data.stat_date)
          row_data.stat_date
        from jsonb_to_recordset(daily_stats_payload) as row_data(
          stat_date date,
          sessions integer,
          sum_pct integer
        )
        where row_data.stat_date is not null
          and row_data.sessions > 0
          and row_data.sum_pct between 0 and row_data.sessions * 100
        order by row_data.stat_date, row_data.sessions desc, row_data.sum_pct desc
      ) as incoming_daily_stats
      where incoming_daily_stats.stat_date = stats.stat_date
    );

  select count(*)
  into synced_word_progress
  from (
    select distinct on (row_data.word_id)
      row_data.word_id
    from jsonb_to_recordset(word_progress_payload) as row_data(
      word_id integer,
      level smallint,
      next_review date,
      last_review date
    )
    where row_data.word_id > 0
      and row_data.level between 0 and 8
      and row_data.next_review is not null
      and (row_data.last_review is null or row_data.last_review <= row_data.next_review)
    order by row_data.word_id, row_data.last_review desc nulls last, row_data.level desc, row_data.next_review desc
  ) as validated_word_progress;

  insert into public.player_word_progress (
    player_id,
    word_id,
    level,
    next_review,
    last_review
  )
  select
    target_player_id,
    validated_word_progress.word_id,
    validated_word_progress.level,
    validated_word_progress.next_review,
    validated_word_progress.last_review
  from (
    select distinct on (row_data.word_id)
      row_data.word_id,
      row_data.level,
      row_data.next_review,
      row_data.last_review
    from jsonb_to_recordset(word_progress_payload) as row_data(
      word_id integer,
      level smallint,
      next_review date,
      last_review date
    )
    where row_data.word_id > 0
      and row_data.level between 0 and 8
      and row_data.next_review is not null
      and (row_data.last_review is null or row_data.last_review <= row_data.next_review)
    order by row_data.word_id, row_data.last_review desc nulls last, row_data.level desc, row_data.next_review desc
  ) as validated_word_progress
  on conflict (player_id, word_id) do update
  set level = excluded.level,
      next_review = excluded.next_review,
      last_review = excluded.last_review,
      updated_at = timezone('utc', now());

  delete from public.player_word_progress as word_progress
  where word_progress.player_id = target_player_id
    and not exists (
      select 1
      from (
        select distinct on (row_data.word_id)
          row_data.word_id
        from jsonb_to_recordset(word_progress_payload) as row_data(
          word_id integer,
          level smallint,
          next_review date,
          last_review date
        )
        where row_data.word_id > 0
          and row_data.level between 0 and 8
          and row_data.next_review is not null
          and (row_data.last_review is null or row_data.last_review <= row_data.next_review)
        order by row_data.word_id, row_data.last_review desc nulls last, row_data.level desc, row_data.next_review desc
      ) as incoming_word_progress
      where incoming_word_progress.word_id = word_progress.word_id
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

revoke all on function public.sync_player_state_from_auth(jsonb) from public;
grant execute on function public.sync_player_state_from_auth(jsonb) to authenticated;

comment on function public.sync_player_state_from_auth(jsonb) is 'Replaces the authenticated players settings, daily stats, and word progress with the current client snapshot.';

commit;