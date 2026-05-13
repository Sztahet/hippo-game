begin;

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

revoke all on function public.get_my_player_snapshot() from public;
grant execute on function public.get_my_player_snapshot() to authenticated;

comment on function public.get_my_player_snapshot() is 'Returns the authenticated players private settings, daily stats, and word progress for local hydration.';

commit;