begin;

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

revoke all on function public.bootstrap_player_from_auth(jsonb) from public;
grant execute on function public.bootstrap_player_from_auth(jsonb) to authenticated;

comment on function public.bootstrap_player_from_auth(jsonb) is 'Creates or links an auth-backed player row and optionally imports legacy local stats from the browser.';

commit;