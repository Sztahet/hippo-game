#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');

function printUsage() {
  console.error([
    'Usage:',
    '  node supabase/generate_import_sql.js --input stats-export.json --handle ania --display-name "Ania" [--private] [--source browser-import]',
    '',
    'Input can use either:',
    '  - raw localStorage keys: vocab_progress, vocab_daily_stats, vocab_active_levels, vocab_ignored_word_ids',
    '  - normalized keys: progress, dailyStats, settings.activeLevels, settings.ignoredWordIds'
  ].join('\n'));
}

function parseArgs(argv) {
  const options = {
    isPublic: true,
    source: 'browser-localstorage-import'
  };

  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];

    if (arg === '--input') {
      options.input = argv[++index];
    } else if (arg === '--handle') {
      options.handle = argv[++index];
    } else if (arg === '--display-name') {
      options.displayName = argv[++index];
    } else if (arg === '--source') {
      options.source = argv[++index];
    } else if (arg === '--private') {
      options.isPublic = false;
    } else if (arg === '--public') {
      options.isPublic = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else {
      throw new Error('Unknown argument: ' + arg);
    }
  }

  return options;
}

function readJson(filePath) {
  const absolutePath = path.resolve(filePath);
  const raw = fs.readFileSync(absolutePath, 'utf8');
  return JSON.parse(raw);
}

function maybeParseJson(value) {
  if (typeof value !== 'string') return value;

  const trimmed = value.trim();
  if (!trimmed) return value;

  const firstChar = trimmed[0];
  if (firstChar !== '{' && firstChar !== '[') return value;

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeLevels(value) {
  const fallback = ['A1', 'A2'];
  if (!Array.isArray(value) || value.length === 0) return fallback;
  const allowed = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  const normalized = value
    .map((item) => String(item).trim().toUpperCase())
    .filter((item) => allowed.has(item));
  return normalized.length ? normalized : fallback;
}

function normalizeIgnoredWordIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function normalizeProgress(progress) {
  if (!progress || typeof progress !== 'object' || Array.isArray(progress)) return [];

  return Object.entries(progress)
    .map(([wordId, entry]) => {
      const numericWordId = Number(wordId);
      if (!Number.isInteger(numericWordId) || numericWordId <= 0) return null;
      if (!entry || typeof entry !== 'object') return null;

      const level = Number(entry.level);
      const nextReview = entry.nextReview;
      const lastReview = entry.lastReview;

      if (!Number.isInteger(level) || level < 0 || level > 8) return null;
      if (!isIsoDate(nextReview)) return null;
      if (lastReview != null && lastReview !== '' && !isIsoDate(lastReview)) return null;

      return {
        wordId: numericWordId,
        level,
        nextReview,
        lastReview: lastReview || null
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.wordId - right.wordId);
}

function normalizeDailyStats(dailyStats) {
  if (!dailyStats || typeof dailyStats !== 'object' || Array.isArray(dailyStats)) return [];

  return Object.entries(dailyStats)
    .map(([dateKey, entry]) => {
      if (!isIsoDate(dateKey)) return null;
      if (!entry || typeof entry !== 'object') return null;

      const sessions = Math.floor(Number(entry.sessions));
      const sumPctRaw = Number(entry.sumPct);
      const avgPctRaw = Number(entry.avgPct);
      const sumPct = Number.isFinite(sumPctRaw)
        ? Math.round(sumPctRaw)
        : (Number.isFinite(avgPctRaw) ? Math.round(avgPctRaw * sessions) : NaN);

      if (!Number.isInteger(sessions) || sessions <= 0) return null;
      if (!Number.isInteger(sumPct) || sumPct < 0 || sumPct > sessions * 100) return null;

      return {
        statDate: dateKey,
        sessions,
        sumPct
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.statDate.localeCompare(right.statDate));
}

function normalizeInput(rawData) {
  const settings = rawData.settings && typeof rawData.settings === 'object' ? rawData.settings : {};
  const progressSource = maybeParseJson(rawData.progress || rawData.vocab_progress || {});
  const dailyStatsSource = maybeParseJson(rawData.dailyStats || rawData.vocab_daily_stats || {});
  const activeLevelsSource = maybeParseJson(settings.activeLevels || rawData.activeLevels || rawData.vocab_active_levels);
  const ignoredWordIdsSource = maybeParseJson(settings.ignoredWordIds || rawData.ignoredWordIds || rawData.vocab_ignored_word_ids);

  return {
    progress: normalizeProgress(progressSource),
    dailyStats: normalizeDailyStats(dailyStatsSource),
    activeLevels: normalizeLevels(activeLevelsSource),
    ignoredWordIds: normalizeIgnoredWordIds(ignoredWordIdsSource)
  };
}

function escapeSqlString(value) {
  return String(value).replace(/'/g, "''");
}

function sqlString(value) {
  return "'" + escapeSqlString(value) + "'";
}

function sqlNullableDate(value) {
  return value ? "date " + sqlString(value) : 'null';
}

function buildValuesBlock(rows, mapper) {
  return rows.map((row) => '  ' + mapper(row)).join(',\n');
}

function buildSqlDocument(options, data) {
  const lines = [];
  const handle = sqlString(options.handle);
  const displayName = sqlString(options.displayName);
  const source = sqlString(options.source);
  const activeLevels = sqlString(JSON.stringify(data.activeLevels));
  const ignoredWordIds = sqlString(JSON.stringify(data.ignoredWordIds));

  lines.push('-- Generated by supabase/generate_import_sql.js');
  lines.push('begin;');
  lines.push('');
  lines.push('insert into public.players (handle, display_name, source, is_public)');
  lines.push('values (' + [handle, displayName, source, options.isPublic ? 'true' : 'false'].join(', ') + ')');
  lines.push('on conflict (handle) do update');
  lines.push('set');
  lines.push('  display_name = excluded.display_name,');
  lines.push('  source = excluded.source,');
  lines.push('  is_public = excluded.is_public,');
  lines.push("  updated_at = timezone('utc', now());");
  lines.push('');
  lines.push('with target_player as (');
  lines.push('  select id from public.players where handle = ' + handle);
  lines.push(')');
  lines.push('insert into public.player_settings (player_id, active_levels, ignored_word_ids)');
  lines.push('select id, ' + activeLevels + '::jsonb, ' + ignoredWordIds + '::jsonb');
  lines.push('from target_player');
  lines.push('on conflict (player_id) do update');
  lines.push('set');
  lines.push('  active_levels = excluded.active_levels,');
  lines.push('  ignored_word_ids = excluded.ignored_word_ids,');
  lines.push("  updated_at = timezone('utc', now());");
  lines.push('');

  if (data.dailyStats.length > 0) {
    lines.push('with target_player as (');
    lines.push('  select id from public.players where handle = ' + handle);
    lines.push('), imported_stats(stat_date, sessions, sum_pct) as (');
    lines.push('values');
    lines.push(buildValuesBlock(data.dailyStats, (row) => '(date ' + sqlString(row.statDate) + ', ' + row.sessions + ', ' + row.sumPct + ')'));
    lines.push(')');
    lines.push('insert into public.player_daily_stats (player_id, stat_date, sessions, sum_pct)');
    lines.push('select target_player.id, imported_stats.stat_date, imported_stats.sessions, imported_stats.sum_pct');
    lines.push('from target_player');
    lines.push('cross join imported_stats');
    lines.push('on conflict (player_id, stat_date) do update');
    lines.push('set');
    lines.push('  sessions = excluded.sessions,');
    lines.push('  sum_pct = excluded.sum_pct,');
    lines.push("  updated_at = timezone('utc', now());");
    lines.push('');
  } else {
    lines.push('-- No daily stats rows found in input.');
    lines.push('');
  }

  if (data.progress.length > 0) {
    lines.push('with target_player as (');
    lines.push('  select id from public.players where handle = ' + handle);
    lines.push('), imported_progress(word_id, level, next_review, last_review) as (');
    lines.push('values');
    lines.push(buildValuesBlock(data.progress, (row) => '(' + [
      row.wordId,
      row.level,
      "date " + sqlString(row.nextReview),
      sqlNullableDate(row.lastReview)
    ].join(', ') + ')'));
    lines.push(')');
    lines.push('insert into public.player_word_progress (player_id, word_id, level, next_review, last_review)');
    lines.push('select target_player.id, imported_progress.word_id, imported_progress.level, imported_progress.next_review, imported_progress.last_review');
    lines.push('from target_player');
    lines.push('cross join imported_progress');
    lines.push('on conflict (player_id, word_id) do update');
    lines.push('set');
    lines.push('  level = excluded.level,');
    lines.push('  next_review = excluded.next_review,');
    lines.push('  last_review = excluded.last_review,');
    lines.push("  updated_at = timezone('utc', now());");
    lines.push('');
  } else {
    lines.push('-- No word progress rows found in input.');
    lines.push('');
  }

  lines.push('select public.refresh_player_public_stats(id)');
  lines.push('from public.players');
  lines.push('where handle = ' + handle + ';');
  lines.push('');
  lines.push('commit;');

  return lines.join('\n');
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    printUsage();
    process.exit(1);
  }

  if (options.help) {
    printUsage();
    process.exit(0);
  }

  if (!options.input || !options.handle || !options.displayName) {
    printUsage();
    process.exit(1);
  }

  if (!/^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$/.test(options.handle)) {
    console.error('Handle must match ^[a-z0-9][a-z0-9_-]{1,30}[a-z0-9]$.');
    process.exit(1);
  }

  if (options.displayName.trim().length < 1 || options.displayName.trim().length > 50) {
    console.error('Display name must be between 1 and 50 characters.');
    process.exit(1);
  }

  const rawData = readJson(options.input);
  const normalizedData = normalizeInput(rawData);
  const sql = buildSqlDocument(options, normalizedData);
  process.stdout.write(sql + '\n');
}

main();