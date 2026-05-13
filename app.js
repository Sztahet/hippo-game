// ===== CONSTANTS =====
const INTERVALS = [0, 1, 3, 7, 14, 30, 90, 180, 730]; // days per level
const SESSION_SIZE = 25;
const STORAGE_KEY = 'vocab_progress';
const SYNC_URL_KEY = 'vocab_sync_url';
const SYNC_TOKEN_KEY = 'vocab_sync_token';
const SUPABASE_URL_KEY = 'vocab_supabase_url';
const SUPABASE_PUBLISHABLE_KEY = 'vocab_supabase_publishable_key';
const ACTIVE_LEVELS_KEY = 'vocab_active_levels';
const IGNORED_WORD_IDS_KEY = 'vocab_ignored_word_ids';
const DAILY_STATS_KEY = 'vocab_daily_stats';
const SUPABASE_IMPORT_VERSION = 'legacy-v1';
const HIPPO_MASCOT_SRC = 'assets/super-hipcio.png';
const HIPPO_JOKE_API_URL = 'https://v2.jokeapi.dev/joke/Misc,Pun?lang=en&safe-mode&amount=6&blacklistFlags=nsfw,religious,political,racist,sexist,explicit';
const HIPPO_JOKE_BLOCKLIST = [
  /\b(?:nsfw|sex|sexy|nude|naked|porn|fetish|explicit)\b/i,
  /\b(?:kill|killed|murder|suicide|corpse|gore|blood|bloody|weapon|gun|bomb|terror)\b/i,
  /\b(?:drug|drugs|weed|cocaine|meth|vodka|whiskey|drunk)\b/i,
  /\b(?:racist|sexist|slur|hate)\b/i
];

const FALLBACK_HIPPO_JOKES = [
  {
    type: 'single',
    joke: 'What is Super Hipcio best at? Big smiles and short English jokes.'
  },
  {
    type: 'twopart',
    setup: 'Why does Super Hipcio like easy English?',
    delivery: 'Because clear words are easier to catch.'
  },
  {
    type: 'twopart',
    setup: 'What did Super Hipcio say after a good lesson?',
    delivery: 'One more word, one more smile.'
  },
  {
    type: 'twopart',
    setup: 'Why is Super Hipcio happy at school?',
    delivery: 'He can catch one new word every day.'
  },
  {
    type: 'twopart',
    setup: 'What is in Super Hipcio\'s bag?',
    delivery: 'Snacks, books, and one more joke.'
  },
  {
    type: 'single',
    joke: 'Super Hipcio likes easy English. Short words make big smiles.'
  },
  {
    type: 'twopart',
    setup: 'Why does Super Hipcio read every day?',
    delivery: 'Books help him catch new words.'
  },
  {
    type: 'twopart',
    setup: 'What does Super Hipcio eat after class?',
    delivery: 'A smart cookie and a small cake.'
  },
  {
    type: 'twopart',
    setup: 'Why does Super Hipcio carry a red hat?',
    delivery: 'It helps him look bright and brave.'
  },
  {
    type: 'single',
    joke: 'Super Hipcio knows one secret: easy words can still be fun.'
  },
  {
    type: 'twopart',
    setup: 'What does Super Hipcio do with a new word?',
    delivery: 'He says it once, then smiles twice.'
  }
];

const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_DESCRIPTIONS = {
  A1: 'Podstawy (985 słów)',
  A2: 'Elementarny',
  B1: 'Średniozaawansowany',
  B2: 'Wyższy średni',
  C1: 'Zaawansowany',
  C2: 'Biegły',
};

// ===== LEGACY PASSWORD FALLBACK =====
// Used only while Supabase Auth is not configured yet.
const ACCESS_PASSWORD = 'hippo123';
const AUTH_KEY = 'vocab_auth';

// ===== STATE =====
let allWords = [];
let progress = {};
let session = [];
let currentIndex = 0;
let sessionResults = []; // { wordId, status: 'correct'|'typo'|'wrong', userAnswer }
let syncUrl = localStorage.getItem(SYNC_URL_KEY) || '';
let syncToken = localStorage.getItem(SYNC_TOKEN_KEY) || '';
let syncStatus = 'idle'; // 'idle' | 'syncing' | 'ok' | 'error'
let activeLevels = loadActiveLevels();
let ignoredWordIds = loadIgnoredWordIds();
let dailyStats = loadDailyStats();
let letterHintState = null; // { wordId, answer, revealed: bool[], count }
let currentScreen = 'boot';
let homeHippoJoke = null;
let hippoJokeRequestId = 0;
let lastHippoJokeKey = '';
let supabaseClient = null;
let supabaseClientCacheKey = '';
let supabaseAuthSubscription = null;
let supabaseSession = null;
let supabaseUser = null;
let initPromise = null;
let authUiMessage = null;
let supabaseImportState = { status: 'idle', result: null, error: null };

// ===== DATA =====
function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadActiveLevels() {
  try {
    const raw = localStorage.getItem(ACTIVE_LEVELS_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      // Validate — must be array of known levels
      if (Array.isArray(saved) && saved.length > 0) return saved;
    }
  } catch {}
  return ['A1', 'A2']; // sensible default — start with basics
}

function saveActiveLevels() {
  localStorage.setItem(ACTIVE_LEVELS_KEY, JSON.stringify(activeLevels));
}

function loadIgnoredWordIds() {
  try {
    const raw = localStorage.getItem(IGNORED_WORD_IDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  } catch {
    return [];
  }
}

function saveIgnoredWordIds() {
  localStorage.setItem(IGNORED_WORD_IDS_KEY, JSON.stringify(ignoredWordIds));
}

function sanitizeDailyStatsMap(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const cleaned = {};
  for (const [dateKey, entry] of Object.entries(parsed)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) continue;
    if (!entry || typeof entry !== 'object') continue;
    const sessionsRaw = Number(entry.sessions);
    const sessions = Math.floor(sessionsRaw);
    const sumPctRaw = Number(entry.sumPct);
    const avgPctRaw = Number(entry.avgPct);
    const sumPct = Number.isFinite(sumPctRaw)
      ? sumPctRaw
      : (Number.isFinite(avgPctRaw) ? avgPctRaw * sessions : 0);
    if (!Number.isFinite(sessions) || sessions <= 0) continue;
    if (!Number.isFinite(sumPct) || sumPct < 0) continue;
    cleaned[dateKey] = {
      sessions,
      sumPct,
      avgPct: Math.round(sumPct / sessions)
    };
  }
  return cleaned;
}

function loadDailyStats() {
  try {
    const raw = localStorage.getItem(DAILY_STATS_KEY);
    if (!raw) return {};
    return sanitizeDailyStatsMap(JSON.parse(raw));
  } catch {
    return {};
  }
}

function saveDailyStats() {
  localStorage.setItem(DAILY_STATS_KEY, JSON.stringify(dailyStats));
}

function buildSettingsPayload() {
  // Backward-compatible payload: older Apps Script deployments persist only activeLevels.
  return {
    activeLevels: JSON.stringify({
      levels: activeLevels,
      ignoredWordIds: ignoredWordIds
    }),
    ignoredWordIds: JSON.stringify(ignoredWordIds),
    dailyStats: JSON.stringify(dailyStats)
  };
}

function getActiveWords() {
  const ignoredSet = new Set(ignoredWordIds);
  return allWords.filter(w => activeLevels.includes(w.level || 'A1') && !ignoredSet.has(Number(w.id)));
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

// ===== GOOGLE SHEETS SYNC =====
/**
 * Normalizes a date value that may arrive as a full Date string
 * (e.g. "Mon Jun 05 2025 00:00:00 GMT+0200") to ISO "yyyy-MM-dd".
 * Passes through values that are already in the correct format.
 */
function toISODate(val) {
  if (!val) return val;
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(val))) return String(val);
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);
  return String(val);
}

function getSyncUrl() {
  return localStorage.getItem(SYNC_URL_KEY) || '';
}

function setSyncUrl(url) {
  syncUrl = url;
  if (url) {
    localStorage.setItem(SYNC_URL_KEY, url);
  } else {
    localStorage.removeItem(SYNC_URL_KEY);
  }
}

function getSyncToken() {
  return localStorage.getItem(SYNC_TOKEN_KEY) || '';
}

function setSyncToken(token) {
  syncToken = token;
  if (token) {
    localStorage.setItem(SYNC_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(SYNC_TOKEN_KEY);
  }
}

function getProjectSupabaseConfig() {
  const config = window.HIPPO_SUPABASE_CONFIG && typeof window.HIPPO_SUPABASE_CONFIG === 'object'
    ? window.HIPPO_SUPABASE_CONFIG
    : {};

  return {
    url: typeof config.url === 'string' ? config.url.trim() : '',
    publishableKey: typeof config.publishableKey === 'string' ? config.publishableKey.trim() : ''
  };
}

function getSupabaseUrl() {
  return (localStorage.getItem(SUPABASE_URL_KEY) || getProjectSupabaseConfig().url || '').trim();
}

function setSupabaseUrl(url) {
  const value = String(url || '').trim();
  if (value) {
    localStorage.setItem(SUPABASE_URL_KEY, value);
  } else {
    localStorage.removeItem(SUPABASE_URL_KEY);
  }
}

function getSupabasePublishableKey() {
  const projectConfig = getProjectSupabaseConfig();
  return (
    localStorage.getItem(SUPABASE_PUBLISHABLE_KEY)
    || projectConfig.publishableKey
    || ''
  ).trim();
}

function setSupabasePublishableKey(key) {
  const value = String(key || '').trim();
  if (value) {
    localStorage.setItem(SUPABASE_PUBLISHABLE_KEY, value);
  } else {
    localStorage.removeItem(SUPABASE_PUBLISHABLE_KEY);
  }
}

function hasSupabaseLocalOverride() {
  return Boolean(
    localStorage.getItem(SUPABASE_URL_KEY)
    || localStorage.getItem(SUPABASE_PUBLISHABLE_KEY)
  );
}

function hasSupabaseConfig() {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}

function hasSupabaseLibrary() {
  return Boolean(window.supabase && typeof window.supabase.createClient === 'function');
}

function hasLegacySession() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

function isHttpOrigin() {
  return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

function getAuthRedirectUrl() {
  if (!isHttpOrigin()) return '';
  return window.location.href.split('#')[0].split('?')[0];
}

function shouldShowSupabaseConfigControls() {
  const projectConfig = getProjectSupabaseConfig();
  return !(projectConfig.url && projectConfig.publishableKey);
}

function getSupabaseImportMarkerKey(userId) {
  return `vocab_supabase_import_${SUPABASE_IMPORT_VERSION}_${userId}`;
}

function getSupabaseImportMarker(userId) {
  if (!userId) return null;
  try {
    const raw = localStorage.getItem(getSupabaseImportMarkerKey(userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSupabaseImportMarker(userId, result, state = 'imported') {
  if (!userId) return;
  localStorage.setItem(getSupabaseImportMarkerKey(userId), JSON.stringify({
    version: SUPABASE_IMPORT_VERSION,
    state,
    importedAt: new Date().toISOString(),
    result: result || null
  }));
}

function hasCompletedSupabaseLegacyImport(importMarker) {
  return Boolean(importMarker && importMarker.state !== 'skipped');
}

function hasLegacyDataForSupabaseImport() {
  return Object.keys(progress).length > 0
    || Object.keys(dailyStats).length > 0
    || ignoredWordIds.length > 0
    || JSON.stringify(activeLevels) !== JSON.stringify(['A1', 'A2']);
}

function getSupabaseDailyStatsRows() {
  return Object.entries(dailyStats)
    .map(([statDate, entry]) => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(statDate)) return null;
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
        stat_date: statDate,
        sessions,
        sum_pct: sumPct
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.stat_date.localeCompare(right.stat_date));
}

function getSupabaseWordProgressRows() {
  return Object.entries(progress)
    .map(([wordId, entry]) => {
      const numericWordId = Number(wordId);
      if (!Number.isInteger(numericWordId) || numericWordId <= 0) return null;
      if (!entry || typeof entry !== 'object') return null;

      const level = Number(entry.level);
      const nextReview = toISODate(entry.nextReview);
      const lastReview = entry.lastReview ? toISODate(entry.lastReview) : null;

      if (!Number.isInteger(level) || level < 0 || level > 8) return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(nextReview))) return null;
      if (lastReview && !/^\d{4}-\d{2}-\d{2}$/.test(String(lastReview))) return null;

      return {
        word_id: numericWordId,
        level,
        next_review: nextReview,
        last_review: lastReview
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.word_id - right.word_id);
}

function getLegacyImportRowCounts() {
  return {
    dailyStats: getSupabaseDailyStatsRows().length,
    wordProgress: getSupabaseWordProgressRows().length
  };
}

function hasLegacyProgressRowsForSupabaseImport() {
  const counts = getLegacyImportRowCounts();
  return counts.dailyStats > 0 || counts.wordProgress > 0;
}

function didSupabaseImportMigrateProgressData(importMarker) {
  const importedDailyStats = Math.max(0, Number(importMarker?.result?.importedDailyStats) || 0);
  const importedWordProgress = Math.max(0, Number(importMarker?.result?.importedWordProgress) || 0);
  return importedDailyStats > 0 || importedWordProgress > 0;
}

function shouldOfferManualLegacyImport(importMarker) {
  if (!hasLegacyDataForSupabaseImport()) return false;
  if (!hasCompletedSupabaseLegacyImport(importMarker)) return true;
  return hasLegacyProgressRowsForSupabaseImport() && !didSupabaseImportMigrateProgressData(importMarker);
}

function buildSupabaseImportPayload() {
  return {
    version: SUPABASE_IMPORT_VERSION,
    settings: {
      activeLevels: [...activeLevels],
      ignoredWordIds: [...ignoredWordIds]
    },
    dailyStats: getSupabaseDailyStatsRows(),
    wordProgress: getSupabaseWordProgressRows()
  };
}

async function fetchSupabasePlayerSnapshot() {
  if (!isSupabaseAuthenticated()) return null;

  const client = getSupabaseClient();
  if (!client) return null;

  const { data, error } = await client.rpc('get_my_player_snapshot');
  if (error) throw error;

  return data || null;
}

function applySupabaseSettingsSnapshot(settings) {
  if (!settings || typeof settings !== 'object') return;

  const remoteLevels = Array.isArray(settings.activeLevels)
    ? settings.activeLevels.filter(level => ALL_LEVELS.includes(level))
    : [];
  if (remoteLevels.length > 0 && !localStorage.getItem(ACTIVE_LEVELS_KEY)) {
    activeLevels = [...new Set(remoteLevels)];
    saveActiveLevels();
  }

  if (Array.isArray(settings.ignoredWordIds) && !localStorage.getItem(IGNORED_WORD_IDS_KEY)) {
    ignoredWordIds = settings.ignoredWordIds
      .map((value) => Number(value))
      .filter((value) => Number.isFinite(value) && value > 0);
    saveIgnoredWordIds();
  }
}

function mergeSupabaseDailyStatsRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;

  let didChange = false;

  rows.forEach((row) => {
    const statDate = toISODate(row?.statDate);
    const sessions = Math.floor(Number(row?.sessions));
    const sumPct = Math.round(Number(row?.sumPct));

    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(statDate))) return;
    if (!Number.isInteger(sessions) || sessions <= 0) return;
    if (!Number.isInteger(sumPct) || sumPct < 0 || sumPct > sessions * 100) return;

    const localEntry = dailyStats[statDate];
    if (!localEntry || sessions > localEntry.sessions || (sessions === localEntry.sessions && sumPct >= localEntry.sumPct)) {
      dailyStats[statDate] = {
        sessions,
        sumPct,
        avgPct: Math.round(sumPct / sessions)
      };
      didChange = true;
    }
  });

  if (didChange) {
    saveDailyStats();
  }

  return didChange;
}

function getProgressRecencyValue(entry) {
  if (!entry || typeof entry !== 'object') return '';

  const lastReview = entry.lastReview ? toISODate(entry.lastReview) : '0000-00-00';
  const nextReview = entry.nextReview ? toISODate(entry.nextReview) : '0000-00-00';
  return `${lastReview}|${nextReview}`;
}

function mergeSupabaseWordProgressRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return false;

  let didChange = false;

  rows.forEach((row) => {
    const wordId = Number(row?.wordId);
    const level = Number(row?.level);
    const nextReview = toISODate(row?.nextReview);
    const lastReview = row?.lastReview ? toISODate(row.lastReview) : null;

    if (!Number.isInteger(wordId) || wordId <= 0) return;
    if (!Number.isInteger(level) || level < 0 || level > 8) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(nextReview))) return;
    if (lastReview && !/^\d{4}-\d{2}-\d{2}$/.test(String(lastReview))) return;

    const remoteEntry = { level, nextReview, lastReview };
    const localEntry = progress[wordId];
    if (!localEntry || getProgressRecencyValue(remoteEntry) >= getProgressRecencyValue(localEntry)) {
      progress[wordId] = remoteEntry;
      didChange = true;
    }
  });

  if (didChange) {
    saveProgress();
  }

  return didChange;
}

function applySupabasePlayerSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') return false;

  applySupabaseSettingsSnapshot(snapshot.settings);
  const dailyStatsChanged = mergeSupabaseDailyStatsRows(snapshot.dailyStats);
  const wordProgressChanged = mergeSupabaseWordProgressRows(snapshot.wordProgress);

  return dailyStatsChanged || wordProgressChanged;
}

async function hydrateLocalStateFromSupabase() {
  if (!isSupabaseAuthenticated()) return null;

  try {
    const snapshot = await fetchSupabasePlayerSnapshot();
    applySupabasePlayerSnapshot(snapshot);
    return snapshot;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function clearSupabaseRedirectState() {
  const hasAuthParams = window.location.search.includes('code=')
    || window.location.search.includes('error=')
    || window.location.hash.includes('access_token=')
    || window.location.hash.includes('refresh_token=')
    || window.location.hash.includes('type=');

  if (hasAuthParams) {
    history.replaceState({}, document.title, window.location.pathname);
  }
}

function setAuthUiMessage(type, text) {
  authUiMessage = { type, text };
}

function clearAuthUiMessage() {
  authUiMessage = null;
}

function formatAuthError(error, fallback = 'Wystąpił błąd logowania.') {
  if (!error) return fallback;
  const message = typeof error === 'string' ? error : error.message;
  return message ? String(message) : fallback;
}

function resetSupabaseClient() {
  if (supabaseAuthSubscription) {
    supabaseAuthSubscription.unsubscribe();
    supabaseAuthSubscription = null;
  }
  supabaseClient = null;
  supabaseClientCacheKey = '';
  supabaseSession = null;
  supabaseUser = null;
  supabaseImportState = { status: 'idle', result: null, error: null };
}

function getSupabaseClient() {
  const url = getSupabaseUrl();
  const publishableKey = getSupabasePublishableKey();
  if (!url || !publishableKey || !hasSupabaseLibrary()) return null;

  const cacheKey = `${url}::${publishableKey}`;
  if (!supabaseClient || supabaseClientCacheKey !== cacheKey) {
    resetSupabaseClient();
    supabaseClient = window.supabase.createClient(url, publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: 'pkce'
      }
    });
    supabaseClientCacheKey = cacheKey;

    const { data } = supabaseClient.auth.onAuthStateChange((event, session) => {
      supabaseSession = session;
      supabaseUser = session ? session.user : null;
      clearSupabaseRedirectState();

      if (!session) {
        supabaseImportState = { status: 'idle', result: null, error: null };
        if (currentScreen === 'settings') {
          renderSettings();
        } else if (currentScreen !== 'login') {
          renderLogin();
        }
        return;
      }

      clearAuthUiMessage();
      if (currentScreen === 'login' || currentScreen === 'boot') {
        init();
      } else if (currentScreen === 'settings') {
        renderSettings();
      }
    });
    supabaseAuthSubscription = data.subscription;
  }

  return supabaseClient;
}

async function refreshSupabaseSession() {
  const client = getSupabaseClient();
  if (!client) {
    supabaseSession = null;
    supabaseUser = null;
    return null;
  }

  const { data, error } = await client.auth.getSession();
  if (error) throw error;

  supabaseSession = data.session;
  supabaseUser = data.session ? data.session.user : null;
  clearSupabaseRedirectState();
  return data.session;
}

async function testSupabaseConnection(url = getSupabaseUrl(), publishableKey = getSupabasePublishableKey()) {
  const trimmedUrl = String(url || '').trim();
  const trimmedPublishableKey = String(publishableKey || '').trim();

  if (!trimmedUrl || !trimmedPublishableKey) {
    throw new Error('Wpisz Project URL i publishable key.');
  }
  if (!hasSupabaseLibrary()) {
    throw new Error('Biblioteka Supabase nie załadowała się poprawnie.');
  }

  const client = window.supabase.createClient(trimmedUrl, trimmedPublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });

  const { count, error } = await client
    .from('player_public_stats')
    .select('player_id', { head: true, count: 'exact' });

  if (error) throw error;
  return count || 0;
}

function isSupabaseAuthenticated() {
  return Boolean(supabaseSession && supabaseUser);
}

function getSignedInUserLabel() {
  if (!supabaseUser) return '';
  return supabaseUser.user_metadata?.full_name
    || supabaseUser.email
    || supabaseUser.phone
    || 'Zalogowany użytkownik';
}

async function maybeBootstrapSupabasePlayer(options = {}) {
  const allowSkippedMarkerOverride = Boolean(options.allowSkippedMarkerOverride);
  const forceImport = Boolean(options.forceImport);
  if (!isSupabaseAuthenticated() || !supabaseUser) return null;
  if (supabaseImportState.status === 'running') return null;

  const hasLegacyImportData = hasLegacyDataForSupabaseImport();
  const importPayload = hasLegacyDataForSupabaseImport()
    ? buildSupabaseImportPayload()
    : { version: SUPABASE_IMPORT_VERSION };
  const importMarker = getSupabaseImportMarker(supabaseUser.id);
  const hasCompletedImport = hasCompletedSupabaseLegacyImport(importMarker);
  if (!forceImport && (hasCompletedImport || (importMarker && !allowSkippedMarkerOverride))) {
    supabaseImportState = {
      status: 'done',
      result: importMarker.result || null,
      error: null
    };
    return importMarker.result || null;
  }

  const client = getSupabaseClient();
  if (!client) return null;

  supabaseImportState = { status: 'running', result: null, error: null };

  try {
    const { data, error } = await client.rpc('bootstrap_player_from_auth', {
      import_payload: importPayload
    });

    if (error) throw error;

    supabaseImportState = { status: 'done', result: data || null, error: null };
    setSupabaseImportMarker(supabaseUser.id, data || null, hasLegacyImportData ? 'imported' : 'skipped');

    if (currentScreen === 'settings') {
      renderSettings();
    }

    return data || null;
  } catch (error) {
    supabaseImportState = {
      status: 'error',
      result: null,
      error: formatAuthError(error, 'Nie udało się przenieść starych danych do Supabase.')
    };
    console.error(error);

    if (currentScreen === 'settings') {
      renderSettings();
    }

    return null;
  }
}

async function pullFromSheets() {
  if (!syncUrl) return null;
  syncStatus = 'syncing';
  updateSyncIndicator();
  try {
    const sep = syncUrl.includes('?') ? '&' : '?';
    const resp = await fetch(syncUrl + sep + 'token=' + encodeURIComponent(syncToken));
    const data = await resp.json();
    if (data.ok) {
      syncStatus = 'ok';
      updateSyncIndicator();
      const raw = data.progress || {};
      // Extract and apply _settings if present
      if (raw._settings && raw._settings.activeLevels) {
        try {
          const remote = JSON.parse(raw._settings.activeLevels);

          // New format: { levels: [...], ignoredWordIds: [...] }
          if (remote && !Array.isArray(remote) && typeof remote === 'object') {
            if (Array.isArray(remote.levels) && remote.levels.length > 0) {
              activeLevels = remote.levels;
              saveActiveLevels();
            }
            if (Array.isArray(remote.ignoredWordIds)) {
              ignoredWordIds = remote.ignoredWordIds
                .map((v) => Number(v))
                .filter((v) => Number.isFinite(v) && v > 0);
              saveIgnoredWordIds();
            }
          }

          // Legacy format: [...levels]
          if (Array.isArray(remote) && remote.length > 0) {
            activeLevels = remote;
            saveActiveLevels();
          }
        } catch {}
      }
      if (raw._settings && raw._settings.ignoredWordIds) {
        try {
          const remoteIgnored = JSON.parse(raw._settings.ignoredWordIds);
          if (Array.isArray(remoteIgnored)) {
            ignoredWordIds = remoteIgnored.map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
            saveIgnoredWordIds();
          }
        } catch {}
      }
      if (raw._settings && raw._settings.dailyStats) {
        try {
          const remoteDailyStatsRaw = JSON.parse(raw._settings.dailyStats);
          if (remoteDailyStatsRaw && typeof remoteDailyStatsRaw === 'object' && !Array.isArray(remoteDailyStatsRaw)) {
            dailyStats = sanitizeDailyStatsMap(remoteDailyStatsRaw);
            saveDailyStats();
          }
        } catch {}
      }
      // Return only real word-progress entries (with normalized dates)
      const cleaned = {};
      for (const [k, v] of Object.entries(raw)) {
        if (k !== '_settings') cleaned[k] = {
          ...v,
          nextReview: toISODate(v.nextReview),
          lastReview: toISODate(v.lastReview),
        };
      }
      return cleaned;
    }
    syncStatus = 'error';
    updateSyncIndicator();
    return null;
  } catch {
    syncStatus = 'error';
    updateSyncIndicator();
    return null;
  }
}

function recordDailySession(sessionPct) {
  const today = getToday();
  const existing = dailyStats[today] || { sessions: 0, sumPct: 0, avgPct: 0 };
  const sessions = Math.max(0, Number(existing.sessions) || 0) + 1;
  const sumPct = Math.max(0, Number(existing.sumPct) || 0) + sessionPct;
  dailyStats[today] = {
    sessions,
    sumPct,
    avgPct: Math.round(sumPct / sessions)
  };
  saveDailyStats();
  if (syncUrl) pushSettingsToSheets();
}

function getRecentDailyStats(days = 10) {
  const labels = [];
  const rows = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);
    const entry = dailyStats[iso] || { sessions: 0, avgPct: 0 };
    const label = iso.slice(5);
    labels.push(label);
    rows.push({
      date: iso,
      label,
      sessions: Number(entry.sessions) || 0,
      avgPct: Number(entry.avgPct) || 0
    });
  }
  return { labels, rows };
}

function getCurrentStreak() {
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const iso = cursor.toISOString().slice(0, 10);
    const entry = dailyStats[iso];
    if (!entry || !(Number(entry.sessions) > 0)) break;
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

async function pushToSheets(changedIds) {
  if (!syncUrl) return;
  const subset = {};
  for (const id of changedIds) {
    if (progress[id]) subset[id] = progress[id];
  }
  // Always push settings alongside progress changes
  subset._settings = buildSettingsPayload();
  syncStatus = 'syncing';
  updateSyncIndicator();
  try {
    await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
      body: JSON.stringify({ token: syncToken, progress: subset })
    });
    syncStatus = 'ok';
  } catch {
    syncStatus = 'error';
  }
  updateSyncIndicator();
}

async function pushSettingsToSheets() {
  if (!syncUrl) return;
  syncStatus = 'syncing';
  updateSyncIndicator();
  try {
    await fetch(syncUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      keepalive: true,
      body: JSON.stringify({
        token: syncToken,
        progress: {
          _settings: buildSettingsPayload()
        }
      })
    });
    syncStatus = 'ok';
  } catch {
    syncStatus = 'error';
  }
  updateSyncIndicator();
}

function updateSyncIndicator() {
  const el = document.getElementById('sync-indicator');
  if (!el) return;
  if (!syncUrl) {
    el.innerHTML = '<span class="sync-dot sync-off"></span> Offline';
    return;
  }
  if (syncStatus === 'syncing') {
    el.innerHTML = '<span class="sync-dot sync-syncing"></span> Synchronizuję...';
  } else if (syncStatus === 'ok') {
    el.innerHTML = '<span class="sync-dot sync-ok"></span> Zsynchronizowano';
  } else if (syncStatus === 'error') {
    el.innerHTML = '<span class="sync-dot sync-error"></span> Błąd synchronizacji';
  } else {
    el.innerHTML = '<span class="sync-dot sync-off"></span> Offline';
  }
}

async function loadWords() {
  const resp = await fetch('words.json');
  return resp.json();
}

function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function buildHippoJokeKey(joke) {
  return [joke.type, joke.joke || '', joke.setup || '', joke.delivery || ''].join('|').toLowerCase();
}

function getFallbackHippoJoke() {
  return {
    ...getRandomItem(FALLBACK_HIPPO_JOKES),
    source: 'local'
  };
}

function getHippoJokeText(joke) {
  if (!joke) return '';
  return [joke.joke, joke.setup, joke.delivery].filter(Boolean).join(' ').trim();
}

function isReadableHippoJoke(joke) {
  const text = getHippoJokeText(joke);
  if (!text) return false;
  if (HIPPO_JOKE_BLOCKLIST.some((pattern) => pattern.test(text))) return false;
  if (/[A-Z]{5,}/.test(text)) return false;

  const normalized = text.replace(/[^a-zA-Z'\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length < 3 || words.length > 40) return false;

  const avgWordLength = words.join('').length / words.length;
  if (avgWordLength > 7.2) return false;

  return true;
}

function normalizeApiHippoJoke(entry) {
  if (entry.type === 'single' && typeof entry.joke === 'string' && entry.joke.trim()) {
    return {
      type: 'single',
      joke: entry.joke.trim(),
      source: 'api'
    };
  }

  if (
    entry.type === 'twopart'
    && typeof entry.setup === 'string' && entry.setup.trim()
    && typeof entry.delivery === 'string' && entry.delivery.trim()
  ) {
    return {
      type: 'twopart',
      setup: entry.setup.trim(),
      delivery: entry.delivery.trim(),
      source: 'api'
    };
  }

  return null;
}

async function fetchHippoApiJokes() {
  const resp = await fetch(HIPPO_JOKE_API_URL, {
    headers: { Accept: 'application/json' }
  });

  if (!resp.ok) {
    throw new Error('Hippo joke request failed');
  }

  const data = await resp.json();
  if (data.error) {
    throw new Error(data.message || 'Hippo joke API returned an error');
  }

  const jokes = Array.isArray(data.jokes) ? data.jokes : [data];
  return jokes
    .map(normalizeApiHippoJoke)
    .filter(Boolean)
    .filter(isReadableHippoJoke);
}

function pickHippoJoke(pool) {
  if (!pool.length) return null;

  const withoutRepeat = pool.filter((joke) => buildHippoJokeKey(joke) !== lastHippoJokeKey);
  const source = withoutRepeat.length ? withoutRepeat : pool;
  return { ...getRandomItem(source) };
}

function getNextHippoJoke(apiJokes = []) {
  const apiPool = apiJokes.map((joke) => ({ ...joke, source: 'api' }));
  const localPool = FALLBACK_HIPPO_JOKES.map((joke) => ({ ...joke, source: 'local' }));

  let selected = pickHippoJoke(apiPool);
  if (!selected) {
    selected = pickHippoJoke(localPool) || getFallbackHippoJoke();
  }

  lastHippoJokeKey = buildHippoJokeKey(selected);
  return selected;
}

function getHippoMascotHtml() {
  return `
    <div class="hippo-joke-mascot-wrap" aria-hidden="true">
      <img class="hippo-joke-mascot" src="${HIPPO_MASCOT_SRC}" alt="">
    </div>
  `;
}

function getHomeHippoJokeHtml() {
  if (!homeHippoJoke) return '';

  if (homeHippoJoke.status === 'loading') {
    return `
      <section class="hippo-joke-card" aria-live="polite">
        <div class="hippo-joke-layout">
          <div class="hippo-joke-copy">
            <div class="hippo-joke-head">
            <div class="hippo-joke-kicker">SUPER HIPCIO</div>
            <div class="hippo-joke-title">English joke break</div>
              <div class="hippo-joke-subtitle">Fresh joke from API, local backup if needed</div>
            </div>
            <div class="hippo-joke-body hippo-joke-body--loading">
              <div class="hippo-joke-loading">
                <span class="hippo-joke-spinner" aria-hidden="true"></span>
                <span>Super Hipcio is fetching a joke...</span>
              </div>
            </div>
            <div class="hippo-joke-actions">
              <button class="btn-hippo btn-hippo-ghost" id="btn-hippo-dismiss">Schowaj</button>
            </div>
          </div>
          ${getHippoMascotHtml()}
        </div>
      </section>
    `;
  }

  const jokeBody = homeHippoJoke.type === 'twopart'
    ? `
      <p class="hippo-joke-line">${escapeHtml(homeHippoJoke.setup)}</p>
      <p class="hippo-joke-delivery">${escapeHtml(homeHippoJoke.delivery)}</p>
    `
    : `<p class="hippo-joke-line">${escapeHtml(homeHippoJoke.joke)}</p>`;

  return `
    <section class="hippo-joke-card" aria-live="polite">
      <div class="hippo-joke-layout">
        <div class="hippo-joke-copy">
          <div class="hippo-joke-head">
          <div class="hippo-joke-kicker">SUPER HIPCIO</div>
          <div class="hippo-joke-title">English joke break</div>
            <div class="hippo-joke-subtitle">Fresh joke from API, local backup if needed</div>
          </div>
          <div class="hippo-joke-body">
            ${jokeBody}
          </div>
          <div class="hippo-joke-note">${homeHippoJoke.source === 'api' ? 'From JokeAPI.' : 'Local fallback when API gives nothing usable.'}</div>
          <div class="hippo-joke-actions">
            <button class="btn-hippo" id="btn-hippo-refresh">Another joke</button>
            <button class="btn-hippo btn-hippo-ghost" id="btn-hippo-dismiss">Schowaj</button>
          </div>
        </div>
        ${getHippoMascotHtml()}
      </div>
    </section>
  `;
}

function dismissHomeHippoJoke() {
  hippoJokeRequestId++;
  homeHippoJoke = null;
  if (currentScreen === 'home') {
    renderHome();
  }
}

function refreshHomeHippoJoke() {
  const requestId = ++hippoJokeRequestId;
  homeHippoJoke = { status: 'loading' };
  if (currentScreen === 'home') {
    renderHome();
  }

  (async () => {
    let apiJokes = [];
    try {
      apiJokes = await fetchHippoApiJokes();
    } catch {}

    const joke = getNextHippoJoke(apiJokes);

    if (requestId !== hippoJokeRequestId) return;

    homeHippoJoke = {
      status: 'ready',
      ...joke
    };

    if (currentScreen === 'home') {
      renderHome();
    }
  })();
}

function returnHomeWithHippoJoke() {
  currentScreen = 'home';
  refreshHomeHippoJoke();
}

// ===== LEVENSHTEIN =====
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[m][n];
}

function normalize(s) {
  return s.trim().toLowerCase();
}

/** Returns the en field as an array, whether it's a string or already an array. */
function getEnArray(word) {
  if (Array.isArray(word.en)) return word.en;
  return [word.en];
}

/** Returns the primary (first) English translation for display. */
function getEnDisplay(word) {
  return Array.isArray(word.en) ? word.en[0] : word.en;
}

/** Returns all English translations joined for display (e.g. "repair / fix"). */
function getEnAllDisplay(word) {
  const arr = getEnArray(word);
  return arr.join(' / ');
}

/**
 * Returns 'correct' | 'typo' | 'wrong'
 * Checks input against all accepted translations.
 */
function checkAnswer(input, word) {
  const a = normalize(input);
  const answers = getEnArray(word);
  for (const ans of answers) {
    if (a === normalize(ans)) return 'correct';
  }
  for (const ans of answers) {
    if (levenshtein(a, normalize(ans)) <= 1) return 'typo';
  }
  return 'wrong';
}

// ===== SPACED REPETITION =====
function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function advanceLevel(wordId, status) {
  const today = getToday();
  const entry = progress[wordId] || { level: 0, nextReview: today, lastReview: null };

  if (status === 'hint-correct') {
    // Hint mode: do not promote the word, schedule repeat for tomorrow.
    entry.nextReview = addDays(today, 1);
    entry.lastReview = today;
    progress[wordId] = entry;
    saveProgress();
    pushToSheets([wordId]);
    return;
  }

  if (status === 'hint-wrong') {
    // Hint mode wrong answer: hard reset.
    entry.level = 0;
    entry.nextReview = addDays(today, Math.max(1, INTERVALS[entry.level]));
    entry.lastReview = today;
    progress[wordId] = entry;
    saveProgress();
    pushToSheets([wordId]);
    return;
  }

  if (status === 'correct') {
    entry.level = Math.min(8, entry.level + 1);
  } else if (status === 'typo') {
    entry.level = Math.max(0, entry.level - 1);
  } else {
    // wrong — reset to 0
    entry.level = 0;
  }

  entry.nextReview = addDays(today, Math.max(1, INTERVALS[entry.level]));
  entry.lastReview = today;
  progress[wordId] = entry;
  saveProgress();
  pushToSheets([wordId]);
}

function getHintChoices(correctWord) {
  const primaryEn = getEnDisplay(correctWord);
  const uniquePool = [];
  const seen = new Set(getEnArray(correctWord).map(normalize));

  for (const w of allWords) {
    const normalized = normalize(getEnDisplay(w));
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    uniquePool.push(getEnDisplay(w));
  }

  for (let i = uniquePool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [uniquePool[i], uniquePool[j]] = [uniquePool[j], uniquePool[i]];
  }

  const options = [primaryEn, ...uniquePool.slice(0, 4)];

  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }

  return options;
}

// ===== SESSION BUILDER =====
function buildSession(words, progress) {
  const today = getToday();

  const due = words.filter(w => {
    const p = progress[w.id];
    return p && p.nextReview <= today && p.level < 8;
  }).sort((a, b) => {
    return (progress[a.id].nextReview).localeCompare(progress[b.id].nextReview);
  });

  const newWords = words.filter(w => !progress[w.id]);

  // New rule: if any due words exist, session is 100% due words.
  // Only when there are no due words, use new words.
  const selectedSource = due.length > 0 ? due : newWords;
  const selected = selectedSource.slice(0, SESSION_SIZE);

  // Shuffle
  for (let i = selected.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [selected[i], selected[j]] = [selected[j], selected[i]];
  }

  return selected.slice(0, SESSION_SIZE);
}

// ===== STATS =====
function getStats() {
  const today = getToday();
  const words = getActiveWords();
  let dueCount = 0;
  let learnedCount = 0;
  let masteredCount = 0;

  for (const w of words) {
    const p = progress[w.id];
    if (!p) continue;
    if (p.level >= 8) {
      masteredCount++;
    } else if (p.nextReview <= today) {
      dueCount++;
    }
    learnedCount++;
  }

  const newCount = words.length - learnedCount;

  // Per-level counts
  const levelCounts = new Array(9).fill(0);
  for (const w of words) {
    const p = progress[w.id];
    if (p) {
      levelCounts[p.level]++;
    }
  }

  return { dueCount, newCount, masteredCount, total: words.length, levelCounts };
}

// ===== RENDERING =====
const app = document.getElementById('app');

function renderHome() {
  currentScreen = 'home';
  const stats = getStats();
  const recent = getRecentDailyStats(10);
  const streak = getCurrentStreak();
  const maxSessions = Math.max(1, ...recent.rows.map(r => r.sessions));
  const BAR_MAX_PX = 108;
  const hippoJokeHtml = getHomeHippoJokeHtml();
  const supabaseImportMarker = isSupabaseAuthenticated() && supabaseUser
    ? getSupabaseImportMarker(supabaseUser.id)
    : null;
  const hasLegacyImportData = hasLegacyDataForSupabaseImport();
  const shouldShowLegacyImportAction = shouldOfferManualLegacyImport(supabaseImportMarker);
  let authStatusHtml = '';

  if (isSupabaseAuthenticated()) {
    let authStatusText = `Zalogowano jako ${escapeHtml(getSignedInUserLabel())}.`;
    let authStatusClass = 'home-auth-status--info';

    if (supabaseImportState.status === 'running') {
      authStatusText = 'Zalogowano. Trwa jednorazowe przenoszenie starych danych z tego urządzenia do Supabase.';
      authStatusClass = 'home-auth-status--info';
    } else if (supabaseImportState.status === 'error') {
      authStatusText = `Zalogowano, ale import starych danych nie powiódł się: ${escapeHtml(supabaseImportState.error)}. Wejdź w Konto i synchronizację.`;
      authStatusClass = 'home-auth-status--error';
    } else if (shouldShowLegacyImportAction && hasCompletedSupabaseLegacyImport(supabaseImportMarker)) {
      authStatusText = `Zalogowano jako ${escapeHtml(getSignedInUserLabel())}. Poprzedni import nie przeniósł jeszcze postępu do Supabase. Wejdź w Konto i synchronizację i uruchom import ręcznie.`;
      authStatusClass = 'home-auth-status--info';
    } else if (hasCompletedSupabaseLegacyImport(supabaseImportMarker)) {
      authStatusText = `Zalogowano jako ${escapeHtml(getSignedInUserLabel())}. Dane z tego urządzenia zostały już przeniesione do Supabase.`;
      authStatusClass = 'home-auth-status--success';
    } else if (hasLegacyImportData) {
      authStatusText = `Zalogowano jako ${escapeHtml(getSignedInUserLabel())}. Na tym urządzeniu wykryto stare dane. Wejdź w Konto i synchronizację, aby ręcznie zaimportować je do Supabase.`;
      authStatusClass = 'home-auth-status--info';
    }

    authStatusHtml = `<div class="home-auth-status ${authStatusClass}">${authStatusText}</div>`;
  }

  const dailyBars = recent.rows.map(r => {
    const hasData = r.sessions > 0;
    const barH = hasData ? Math.max(14, Math.round((r.sessions / maxSessions) * BAR_MAX_PX)) : 0;
    let barBg = '#e2e8f0';
    if (hasData) {
      if (r.avgPct >= 80) barBg = 'linear-gradient(to top, #16a34a, #4ade80)';
      else if (r.avgPct >= 60) barBg = 'linear-gradient(to top, #2563eb, #60a5fa)';
      else if (r.avgPct >= 40) barBg = 'linear-gradient(to top, #b45309, #fbbf24)';
      else barBg = 'linear-gradient(to top, #b91c1c, #f87171)';
    }
    return `
      <div class="daily-col" title="${r.date}${hasData ? ': ' + r.sessions + ' sesji, wynik ' + r.avgPct + '%' : ': brak danych'}">
        <div class="daily-col-pct">${hasData ? r.avgPct + '%' : ''}</div>
        <div class="daily-col-bar" style="height:${barH}px;background:${barBg};"></div>
        <div class="daily-col-date">${r.label}</div>
      </div>
    `;
  }).join('');
  app.innerHTML = `
    <div class="screen">
      <h1>Nauka Słówek PL → EN</h1>
      ${authStatusHtml}
      ${hippoJokeHtml}
      <div class="stats">
        <div class="stat-box">
          <div class="stat-number stat-due">${stats.dueCount}</div>
          <div class="stat-label">Do powtórki</div>
        </div>
        <div class="stat-box">
          <div class="stat-number stat-new">${stats.newCount}</div>
          <div class="stat-label">Nowych</div>
        </div>
        <div class="stat-box">
          <div class="stat-number stat-mastered">${stats.masteredCount}</div>
          <div class="stat-label">Opanowanych</div>
        </div>
      </div>
      <div class="level-breakdown">
        <h2>Rozkład poziomów</h2>
        <div class="level-table">
          <div class="level-row level-header">
            <span>Poziom</span>
            <span>Interwał</span>
            <span>Ilość</span>
          </div>
          <div class="level-row">
            <span>Nowe</span>
            <span>—</span>
            <span class="level-count">${stats.newCount}</span>
          </div>
          ${[
            ['0', 'błędne (reset)'],
            ['1', '1 dzień'],
            ['2', '3 dni'],
            ['3', '7 dni'],
            ['4', '14 dni'],
            ['5', '30 dni'],
            ['6', '90 dni'],
            ['7', '180 dni'],
            ['8', 'opanowane']
          ].map(([lvl, label]) => `
          <div class="level-row">
            <span>Poziom ${lvl}</span>
            <span>${label}</span>
            <span class="level-count">${stats.levelCounts[parseInt(lvl)]}</span>
          </div>`).join('')}
        </div>
      </div>
      <div class="daily-stats-card">
        <h2>Dzienne statystyki</h2>
        <div class="streak-row">${streak >= 7 ? '🔥' : streak >= 3 ? '⚡' : '📅'} Seria: <strong class="streak-count">${streak}</strong> ${streak === 1 ? 'dzień' : 'dni'} z rzędu</div>
        <div class="daily-bars">${dailyBars}</div>
        <div class="daily-legend">
          <span><i class="legend-dot" style="background:#4ade80;"></i> ≥80%</span>
          <span><i class="legend-dot" style="background:#60a5fa;"></i> ≥60%</span>
          <span><i class="legend-dot" style="background:#fbbf24;"></i> ≥40%</span>
          <span><i class="legend-dot" style="background:#f87171;"></i> &lt;40%</span>
          <span class="legend-note">• wys. = sesje</span>
        </div>
      </div>
      ${stats.dueCount + stats.newCount > 0
        ? '<button class="btn btn-primary" id="btn-start">Zacznij sesję</button>'
        : '<p style="text-align:center;color:#888;">Brak słówek do nauki na dziś. Wróć jutro!</p>'
      }
      <div id="sync-indicator" class="sync-indicator"></div>
      <button class="btn btn-secondary" id="btn-settings">⚙ Konto i synchronizacja</button>
      <button class="btn btn-secondary" id="btn-reset">Resetuj postęp</button>
    </div>
  `;

  updateSyncIndicator();

  const btnStart = document.getElementById('btn-start');
  if (btnStart) {
    btnStart.addEventListener('click', startSession);
  }

  const btnHippoRefresh = document.getElementById('btn-hippo-refresh');
  if (btnHippoRefresh) {
    btnHippoRefresh.addEventListener('click', refreshHomeHippoJoke);
  }

  const btnHippoDismiss = document.getElementById('btn-hippo-dismiss');
  if (btnHippoDismiss) {
    btnHippoDismiss.addEventListener('click', dismissHomeHippoJoke);
  }

  document.getElementById('btn-settings').addEventListener('click', renderSettings);

  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Czy na pewno chcesz zresetować cały postęp?')) {
      localStorage.removeItem(STORAGE_KEY);
      progress = {};
      renderHome();
    }
  });
}

function startSession() {
  currentScreen = 'card';
  const activeWords = getActiveWords();
  if (activeWords.length === 0) {
    renderSettings();
    return;
  }
  session = buildSession(activeWords, progress);
  if (session.length === 0) {
    renderHome();
    return;
  }
  currentIndex = 0;
  sessionResults = [];
  renderCard();
}

function renderCard(mode = 'input') {
  currentScreen = 'card';
  const word = session[currentIndex];
  const pct = Math.round((currentIndex / session.length) * 100);
  const isHintMode = mode === 'hint';
  const isLetterHintMode = mode === 'letter-hint';

  // Reset letter hint state when entering a fresh card
  if (mode === 'input') {
    letterHintState = null;
  }

  // Initialize letter hint state when entering that mode
  if (isLetterHintMode && (!letterHintState || letterHintState.wordId !== word.id)) {
    const answer = getEnDisplay(word);
    letterHintState = {
      wordId: word.id,
      answer,
      revealed: answer.split('').map(c => c === ' '),
      count: 0
    };
  }

  const hintChoices = isHintMode ? getHintChoices(word) : [];

  const buildLetterBoxes = () => letterHintState.answer.split('').map((c, i) => {
    if (c === ' ') return `<span class="letter-box letter-space"> </span>`;
    if (letterHintState.revealed[i]) return `<span class="letter-box letter-revealed">${escapeHtml(c)}</span>`;
    return `<span class="letter-box letter-hidden"></span>`;
  }).join('');

  const unrevealedCount = isLetterHintMode
    ? letterHintState.answer.split('').filter((c, i) => c !== ' ' && !letterHintState.revealed[i]).length
    : 0;

  app.innerHTML = `
    <div class="screen">
      <div class="progress-text">${currentIndex + 1} / ${session.length}</div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="card">
        <div class="word-pl">${escapeHtml(word.pl)}</div>
        ${isHintMode ? `
          <div class="word-hint">Wybierz poprawne tłumaczenie (tryb podpowiedzi)</div>
          <div class="hint-options" id="hint-options">
            ${hintChoices.map((choice, idx) => `
              <button class="hint-option-btn" data-choice-index="${idx}">${escapeHtml(choice)}</button>
            `).join('')}
          </div>
        ` : isLetterHintMode ? `
          <div class="word-hint" id="letter-hint-subtitle">🔤 Podpowiedź literowa — ${letterHintState.answer.length} liter${unrevealedCount > 0 ? ` · ${unrevealedCount} ukrytych` : ''}</div>
          <div class="letter-hint-display" id="letter-hint-display">${buildLetterBoxes()}</div>
          <div class="input-group" style="margin-top:0.75rem;">
            <input type="text" class="input-answer" id="input-answer" autocomplete="off" autofocus>
            <button class="btn-submit" id="btn-check">→</button>
          </div>
          ${unrevealedCount > 0 ? `<button class="btn btn-secondary" id="btn-reveal-letter" style="margin-top:0.6rem;">🔍 Odkryj losową literę</button>` : ''}
        ` : `
          <div class="word-hint">Wpisz tłumaczenie po angielsku</div>
          <div class="input-group">
            <input type="text" class="input-answer" id="input-answer" autocomplete="off" autofocus>
            <button class="btn-submit" id="btn-check">→</button>
          </div>
          <button class="btn btn-secondary" id="btn-hint" style="margin-top:0.75rem;">🃏 Podpowiedź (5 opcji)</button>
          <button class="btn btn-secondary" id="btn-letter-hint" style="margin-top:0.5rem;">🔤 Podpowiedź literowa</button>
        `}
      </div>
    </div>
  `;

  if (isHintMode) {
    document.querySelectorAll('.hint-option-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const choiceIndex = Number(btn.dataset.choiceIndex);
        const choice = hintChoices[choiceIndex] || '';
        const status = getEnArray(word).some(ans => normalize(choice) === normalize(ans)) ? 'hint-correct' : 'hint-wrong';
        sessionResults.push({
          wordId: word.id,
          status,
          userAnswer: choice,
          correctAnswer: getEnAllDisplay(word),
          pl: word.pl,
          mode: 'hint'
        });
        advanceLevel(word.id, status);
        renderFeedback(word, status, choice);
      });
    });
    return;
  }

  if (isLetterHintMode) {
    const input = document.getElementById('input-answer');
    const btnCheck = document.getElementById('btn-check');
    const btnReveal = document.getElementById('btn-reveal-letter');
    input.focus();

    const submit = () => {
      const answer = input.value;
      if (!answer.trim()) return;
      const correctness = checkAnswer(answer, word);
      const status = correctness === 'wrong' ? 'hint-wrong' : 'hint-correct';
      sessionResults.push({
        wordId: word.id, status, userAnswer: answer,
        correctAnswer: getEnAllDisplay(word), pl: word.pl, mode: 'letter-hint'
      });
      letterHintState = null;
      advanceLevel(word.id, status);
      renderFeedback(word, status, answer);
    };

    input.addEventListener('keydown', e => { if (e.key === 'Enter') submit(); });
    btnCheck.addEventListener('click', submit);

    if (btnReveal) {
      btnReveal.addEventListener('click', () => {
        const unrevealed = [];
        for (let i = 0; i < letterHintState.answer.length; i++) {
          if (letterHintState.answer[i] !== ' ' && !letterHintState.revealed[i]) unrevealed.push(i);
        }
        if (unrevealed.length === 0) return;
        const idx = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        letterHintState.revealed[idx] = true;
        letterHintState.count++;

        // Update display in-place (preserves input focus)
        const displayEl = document.getElementById('letter-hint-display');
        if (displayEl) displayEl.innerHTML = buildLetterBoxes();

        const newUnrevealed = letterHintState.answer.split('').filter((c, i) => c !== ' ' && !letterHintState.revealed[i]).length;
        const subtitleEl = document.getElementById('letter-hint-subtitle');
        if (subtitleEl) subtitleEl.textContent = `🔤 Podpowiedź literowa — ${letterHintState.answer.length} liter${newUnrevealed > 0 ? ` · ${newUnrevealed} ukrytych` : ''}`;
        if (newUnrevealed === 0) btnReveal.style.display = 'none';
      });
    }
    return;
  }

  // Normal input mode
  const input = document.getElementById('input-answer');
  const btnCheck = document.getElementById('btn-check');
  const btnHint = document.getElementById('btn-hint');
  const btnLetterHint = document.getElementById('btn-letter-hint');
  input.focus();

  const submit = () => {
    const answer = input.value;
    if (!answer.trim()) return;
    const status = checkAnswer(answer, word);
    sessionResults.push({ wordId: word.id, status, userAnswer: answer, correctAnswer: getEnAllDisplay(word), pl: word.pl, mode: 'typed' });
    advanceLevel(word.id, status);
    renderFeedback(word, status, answer);
  };

  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  btnCheck.addEventListener('click', submit);
  btnHint.addEventListener('click', () => renderCard('hint'));
  btnLetterHint.addEventListener('click', () => renderCard('letter-hint'));
}

function renderFeedback(word, status, userAnswer) {
  currentScreen = 'feedback';
  let icon, cls, text;
  if (status === 'correct') {
    icon = '✓';
    cls = 'feedback-correct';
    text = 'Poprawnie!';
  } else if (status === 'hint-correct') {
    icon = '💡';
    cls = 'feedback-typo';
    text = 'Poprawnie z podpowiedzią — poziom bez zmian, powtórka jutro';
  } else if (status === 'hint-wrong') {
    icon = '✗';
    cls = 'feedback-wrong';
    text = 'Błąd w trybie podpowiedzi — reset poziomu';
  } else if (status === 'typo') {
    icon = '≈';
    cls = 'feedback-typo';
    text = 'Literówka — cofam o 1 poziom';
  } else {
    icon = '✗';
    cls = 'feedback-wrong';
    text = 'Źle — reset poziomu';
  }

  const isError = status !== 'correct' && status !== 'hint-correct';
  const delayMs = status === 'correct' ? 1000 : status === 'hint-correct' ? 1200 : 6000;

  const comparisonHtml = isError ? `
    <div class="answer-comparison">
      <div class="answer-row answer-row--wrong">
        <span class="answer-row-label">Twoja odpowiedź</span>
        <span class="answer-row-value">${escapeHtml(userAnswer)}</span>
      </div>
      <div class="answer-row answer-row--correct">
        <span class="answer-row-label">Poprawna odpowiedź</span>
        <span class="answer-row-value">${escapeHtml(getEnAllDisplay(word))}</span>
      </div>
    </div>
  ` : `<div class="feedback-answer">${escapeHtml(getEnAllDisplay(word))}</div>`;

  app.innerHTML = `
    <div class="screen">
      <div class="progress-text">${currentIndex + 1} / ${session.length}</div>
      <div class="feedback ${cls}">
        <div class="feedback-icon">${icon}</div>
        <div class="feedback-text">${text}</div>
        ${comparisonHtml}
        ${isError ? `
        <div class="feedback-timer-row">
          <button class="btn-skip-feedback" id="btn-skip">Przejdź dalej <span class="skip-countdown" id="skip-countdown"></span></button>
        </div>` : ''}
      </div>
    </div>
  `;

  const advance = () => {
    clearInterval(timerHandle);
    currentIndex++;
    if (currentIndex < session.length) renderCard();
    else renderSummary();
  };

  let timerHandle;
  if (isError) {
    const totalSecs = Math.round(delayMs / 1000);
    let remaining = totalSecs;
    const countdownEl = document.getElementById('skip-countdown');
    if (countdownEl) countdownEl.textContent = `(${remaining}s)`;
    timerHandle = setInterval(() => {
      remaining--;
      const el = document.getElementById('skip-countdown');
      if (el) el.textContent = remaining > 0 ? `(${remaining}s)` : '';
      if (remaining <= 0) advance();
    }, 1000);
    const skipBtn = document.getElementById('btn-skip');
    if (skipBtn) skipBtn.addEventListener('click', advance);
  } else {
    timerHandle = setTimeout(advance, delayMs);
  }
}

function renderSummary() {
  currentScreen = 'summary';
  const correct = sessionResults.filter(r => r.status === 'correct').length;
  const hintCorrect = sessionResults.filter(r => r.status === 'hint-correct').length;
  const typos = sessionResults.filter(r => r.status === 'typo').length;
  const wrong = sessionResults.filter(r => r.status === 'wrong' || r.status === 'hint-wrong').length;
  const total = sessionResults.length;
  const pct = Math.round(((correct + hintCorrect) / total) * 100);
  const isPerfectSession = total > 0 && (correct + hintCorrect) === total;

  recordDailySession(pct);

  const ignoredSet = new Set(ignoredWordIds);
  const wordRows = sessionResults.map(r => {
    const isCorrect = r.status === 'correct' || r.status === 'hint-correct';
    const isTypo = r.status === 'typo';
    const dotClass = isCorrect ? 'dot-correct' : isTypo ? 'dot-typo' : 'dot-wrong';
    const statusLabel = r.status === 'hint-correct'
      ? '<span class="word-result-note">(podpowiedź)</span>'
      : r.status === 'hint-wrong'
        ? '<span class="word-result-note">(podpowiedź: reset)</span>'
        : isTypo
          ? '<span class="word-result-note">(literówka)</span>'
          : '';
    const isIgnored = ignoredSet.has(Number(r.wordId));
    const showComparison = !isCorrect && r.userAnswer;
    return `
      <div class="word-result ${showComparison ? 'word-result--error' : ''}">
        <div class="word-result-top">
          <div style="display:flex;align-items:center;flex:1;min-width:0;">
            <div class="word-result-status ${dotClass}"></div>
            <span class="word-result-pl">${escapeHtml(r.pl)} ${statusLabel}</span>
          </div>
          <div class="word-result-right">
            <span class="word-result-en">${escapeHtml(r.correctAnswer)}</span>
            <button class="btn-ignore-word" data-word-id="${r.wordId}" ${isIgnored ? 'disabled' : ''}>
              ${isIgnored ? 'Ignorowane' : 'Ignoruj'}
            </button>
          </div>
        </div>
        ${showComparison ? `
        <div class="word-result-comparison">
          <span class="wrc-wrong">${escapeHtml(r.userAnswer)}</span>
          <span class="wrc-arrow">→</span>
          <span class="wrc-correct">${escapeHtml(r.correctAnswer)}</span>
        </div>` : ''}
      </div>
    `;
  }).join('');

  app.innerHTML = `
    <div class="screen">
      <h1>Podsumowanie sesji</h1>
      ${isPerfectSession ? `
      <div class="perfect-session-banner">
        <div class="perfect-session-hippo">🦛✨</div>
        <div class="perfect-session-title">Szczęśliwy Hipek!</div>
        <div class="perfect-session-text">${total}/${total}, sesja zaliczona na 100%!</div>
      </div>` : ''}
      <div class="summary-card">
        <div class="summary-score">${pct}%</div>
        <div class="summary-score-label">poprawnych odpowiedzi</div>
        <div class="summary-row">
          <span>Poprawne</span>
          <span class="summary-correct">${correct}</span>
        </div>
        <div class="summary-row">
          <span>Poprawne z podpowiedzią (bez awansu)</span>
          <span class="summary-correct">${hintCorrect}</span>
        </div>
        <div class="summary-row">
          <span>Literówki (−1 poziom)</span>
          <span class="summary-typo">${typos}</span>
        </div>
        <div class="summary-row">
          <span>Błędne (reset)</span>
          <span class="summary-wrong">${wrong}</span>
        </div>
      </div>
      <div class="summary-card">
        <h2>Szczegóły</h2>
        ${wordRows}
      </div>
      <button class="btn btn-primary" id="btn-home">Wróć do ekranu głównego</button>
    </div>
  `;

  if (isPerfectSession) {
    // Small delayed popup gives a celebratory effect after summary render.
    setTimeout(showHappyHippoPopup, 150);
  }

  document.querySelectorAll('.btn-ignore-word').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.wordId);
      if (!Number.isFinite(id)) return;
      ignoreWordById(id);
      btn.textContent = 'Ignorowane';
      btn.disabled = true;
    });
  });

  document.getElementById('btn-home').addEventListener('click', returnHomeWithHippoJoke);
}

function ignoreWordById(wordId) {
  if (ignoredWordIds.includes(wordId)) return;
  ignoredWordIds.push(wordId);
  saveIgnoredWordIds();

  // Remove progress so ignored words fully disappear from active queues and stats.
  if (progress[wordId]) {
    delete progress[wordId];
    saveProgress();
  }

  if (syncUrl) {
    pushSettingsToSheets();
  }
}

function showHappyHippoPopup() {
  if (document.getElementById('happy-hippo-popup')) return;

  const overlay = document.createElement('div');
  overlay.id = 'happy-hippo-popup';
  overlay.className = 'hippo-popup-overlay';
  overlay.innerHTML = `
    <div class="hippo-popup-card" role="dialog" aria-live="polite" aria-label="Perfect session celebration">
      <div class="hippo-popup-emoji">🦛🎉</div>
      <h2>Szczęśliwy Hipek!</h2>
      <p>Perfekcyjna sesja: ${sessionResults.length}/${sessionResults.length} poprawnych odpowiedzi.</p>
      <button class="btn btn-primary" id="btn-close-hippo-popup">Super!</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => {
    overlay.remove();
  };

  document.getElementById('btn-close-hippo-popup').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
}

// ===== SETTINGS SCREEN =====
function renderSettings() {
  currentScreen = 'settings';
  const currentUrl = getSyncUrl();
  const currentSupabaseUrl = getSupabaseUrl();
  const currentSupabasePublishableKey = getSupabasePublishableKey();
  const supabaseConfigured = hasSupabaseConfig();
  const supabaseSignedIn = isSupabaseAuthenticated();
  const supabaseUserLabel = supabaseSignedIn ? getSignedInUserLabel() : '';
  const showSupabaseConfigControls = shouldShowSupabaseConfigControls();
  const supabaseProjectConfig = getProjectSupabaseConfig();
  const hasSupabaseProjectConfig = Boolean(
    supabaseProjectConfig.url && supabaseProjectConfig.publishableKey
  );
  const supabaseImportMarker = supabaseSignedIn && supabaseUser
    ? getSupabaseImportMarker(supabaseUser.id)
    : null;
  const hasLegacyImportData = hasLegacyDataForSupabaseImport();
  const hasCompletedImport = hasCompletedSupabaseLegacyImport(supabaseImportMarker);
  const didImportProgressData = didSupabaseImportMigrateProgressData(supabaseImportMarker);
  const shouldShowManualImportButton = supabaseSignedIn
    && shouldOfferManualLegacyImport(supabaseImportMarker)
    && supabaseImportState.status !== 'running';
  const shouldSuggestReimport = supabaseSignedIn
    && hasCompletedImport
    && hasLegacyProgressRowsForSupabaseImport()
    && !didImportProgressData;
  const canManuallyImportLegacyData = supabaseSignedIn
    && shouldShowManualImportButton
    && supabaseImportState.status !== 'running';
  const authRedirectUrl = getAuthRedirectUrl();
  const ignoredCount = ignoredWordIds.length;
  const ignoredSet = new Set(ignoredWordIds);
  const ignoredWords = allWords.filter(w => ignoredSet.has(Number(w.id)));
  const ignoredListHtml = ignoredWords.length
    ? ignoredWords.map(w => `
      <div class="ignored-word-row">
        <div>
          <div class="ignored-word-pl">${escapeHtml(w.pl)}</div>
          <div class="ignored-word-en">${escapeHtml(getEnAllDisplay(w))}</div>
        </div>
        <button class="btn-unignore-word" data-word-id="${w.id}">Przywróć</button>
      </div>
    `).join('')
    : '<p style="font-size:0.9rem;color:#6b7280;">Brak ignorowanych słówek.</p>';

  // Build word counts per level for display
  const levelCounts = {};
  for (const lvl of ALL_LEVELS) levelCounts[lvl] = 0;
  for (const w of allWords) levelCounts[w.level || 'A1']++;

  const levelTogglesHtml = ALL_LEVELS.map(lvl => {
    const active = activeLevels.includes(lvl);
    const count = levelCounts[lvl] || 0;
    return `
      <label class="level-toggle ${active ? 'level-toggle--active' : ''}" data-level="${lvl}">
        <input type="checkbox" ${active ? 'checked' : ''} data-level="${lvl}" style="display:none;">
        <span class="level-badge level-${lvl.toLowerCase()}">${lvl}</span>
        <span class="level-info">
          <span class="level-name">${LEVEL_DESCRIPTIONS[lvl]}</span>
          <span class="level-count">${count} słów</span>
        </span>
        <span class="level-check">${active ? '✓' : ''}</span>
      </label>`;
  }).join('');

  app.innerHTML = `
    <div class="screen">
      <h1>⚙️ Ustawienia</h1>

      <div class="card" style="text-align:left;">
        <h2 style="font-size:1rem;margin-bottom:0.75rem;">Poziomy CEFR do nauki</h2>
        <p style="font-size:0.85rem;color:#555;margin-bottom:1rem;">Zaznacz które poziomy chcesz ćwiczyć. Co najmniej jeden musi być wybrany.</p>
        <div id="level-toggles">
          ${levelTogglesHtml}
        </div>
        <div id="level-warning" style="display:none;margin-top:0.5rem;color:#991b1b;font-size:0.85rem;">
          ⚠️ Wybierz co najmniej jeden poziom.
        </div>
        <button class="btn btn-primary" id="btn-save-levels" style="margin-top:1rem;">Zapisz poziomy</button>
      </div>

      <div class="card" style="text-align:left;margin-top:1rem;">
        <h2 style="font-size:1rem;margin-bottom:0.75rem;">Ignorowane słówka</h2>
        <p style="font-size:0.9rem;color:#555;">Aktualnie ignorowane: <strong id="ignored-count">${ignoredCount}</strong></p>
        <p style="font-size:0.85rem;color:#6b7280;margin:0.5rem 0 1rem;">Słówka oznaczysz jako ignorowane w podsumowaniu sesji. Ignorowane nie trafiają do kolejnych sesji.</p>
        <div class="ignored-words-list" id="ignored-words-list">${ignoredListHtml}</div>
        <button class="btn btn-secondary" id="btn-clear-ignored" ${ignoredCount === 0 ? 'disabled' : ''}>Wyczyść listę ignorowanych</button>
      </div>

      <div class="card" style="text-align:left;margin-top:1rem;">
        <h2 style="font-size:1rem;margin-bottom:0.75rem;">Konto i logowanie Supabase</h2>
        <p style="margin-bottom:1rem;color:#555;font-size:0.85rem;line-height:1.55;">
          ${supabaseSignedIn
            ? `Zalogowany jako <strong>${escapeHtml(supabaseUserLabel)}</strong>.`
            : supabaseConfigured
              ? 'Konfiguracja Supabase jest gotowa. Logowanie działa magic linkiem wysyłanym na e-mail.'
              : 'Brak konfiguracji Supabase. Wklej dane projektu albo wpisz je na stale w pliku supabase-config.js.'}
        </p>
        <div class="auth-inline-result" style="margin-bottom:1rem;">
          ${supabaseImportState.status === 'running'
            ? '<span style="color:#1d4ed8;">Przenoszę stare dane z tego urządzenia do Supabase...</span>'
            : supabaseImportState.status === 'error'
              ? `<span style="color:#991b1b;">${escapeHtml(supabaseImportState.error)}</span>`
              : shouldSuggestReimport
                ? '<span style="color:#b45309;">Poprzedni import nie przeniósł jeszcze daily stats albo progressu słówek do Supabase. Uruchom import ponownie ręcznie.</span>'
              : hasCompletedImport
                ? `<span style="color:#166534;">Stare dane z tego urządzenia zostały już przeniesione do Supabase (${escapeHtml(new Date(supabaseImportMarker.importedAt).toLocaleString('pl-PL'))}).</span>`
                : hasLegacyImportData
                  ? '<span style="color:#166534;">Na tym urządzeniu wykryto stare dane. Możesz ręcznie zaimportować je do Supabase.</span>'
                : supabaseSignedIn
                  ? '<span style="color:#555;">Jeśli chcesz przenieść stare dane z tego urządzenia albo po wcześniejszym pobraniu ich z Google Sheets, uruchom ręczny import poniżej.</span>'
                  : '<span style="color:#555;">Użytkownicy logują się magic linkiem. Konfiguracja projektu nie jest pokazywana na produkcji.</span>'}
        </div>
        ${showSupabaseConfigControls ? `
        <label class="settings-label">Project URL:</label>
        <input type="url" class="input-answer" id="input-supabase-url"
          placeholder="https://twoj-projekt.supabase.co"
          value="${escapeHtml(currentSupabaseUrl)}"
          style="width:100%;margin:0.75rem 0;">
        <label class="settings-label">Publishable key:</label>
        <textarea class="auth-textarea" id="input-supabase-publishable-key"
          placeholder="sb_publishable_xxxxx"
          style="width:100%;margin:0.75rem 0;">${escapeHtml(currentSupabasePublishableKey)}</textarea>
        <div class="auth-config-actions">
          <button class="btn btn-primary" id="btn-save-supabase" style="flex:1;">Zapisz konfigurację</button>
          <button class="btn btn-secondary" id="btn-test-supabase" style="flex:1;margin-top:0;">Testuj</button>
        </div>
        ${hasSupabaseLocalOverride() ? '<button class="btn btn-secondary" id="btn-clear-supabase">Usuń lokalne nadpisanie</button>' : ''}
        ` : ''}
        ${supabaseSignedIn ? `<button class="btn btn-secondary" id="btn-import-legacy-supabase" ${canManuallyImportLegacyData ? '' : 'disabled'}>${shouldSuggestReimport ? 'Spróbuj ponownie zaimportować stare dane' : 'Importuj stare dane do Supabase teraz'}</button>` : ''}
        ${supabaseSignedIn ? '<p style="font-size:0.85rem;color:#6b7280;line-height:1.55;margin-top:0.75rem;">Jeśli stare dane są jeszcze tylko w Google Sheets, najpierw użyj „Pobierz postęp z Sheets”, a dopiero potem uruchom import do Supabase.</p>' : ''}
        ${supabaseConfigured && !supabaseSignedIn ? '<button class="btn btn-secondary" id="btn-open-auth-screen">Przejdź do logowania Supabase</button>' : ''}
        ${supabaseSignedIn ? '<button class="btn btn-secondary" id="btn-signout-supabase">Wyloguj się</button>' : ''}
        <div id="supabase-config-result" class="auth-inline-result"></div>
        ${showSupabaseConfigControls ? '<hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">' : ''}
        <p style="font-size:0.85rem;color:#555;line-height:1.55;">
          ${showSupabaseConfigControls
            ? hasSupabaseProjectConfig
              ? 'Projekt ma juz wpisana konfiguracje Supabase. Pola powyzej dzialaja jako lokalne nadpisanie na tym urzadzeniu.'
              : 'Project URL i publishable key sa publiczne, wiec mozesz wpisac je na stale w supabase-config.js i wypchnac na GitHub Pages.'
            : 'Konfiguracja Supabase jest wbudowana w aplikację, więc zwykli użytkownicy nie muszą nic tutaj zmieniać.'}
        </p>
        ${showSupabaseConfigControls ? `<p class="auth-config-note" style="margin-top:0.75rem;">
          ${authRedirectUrl
            ? `Redirect URL do wpisania w Supabase Auth: <strong>${escapeHtml(authRedirectUrl)}</strong>`
            : 'Do testow lokalnych uruchom aplikacje przez http://localhost, nie przez file://.'}
        </p>` : ''}
      </div>

      <div class="card" style="text-align:left;margin-top:1rem;">
        <h2 style="font-size:1rem;margin-bottom:0.75rem;">Synchronizacja z Google Sheets</h2>
        <p style="margin-bottom:1rem;color:#555;font-size:0.85rem;">Połącz z Google Sheets aby synchronizować postęp między urządzeniami.</p>
        <label style="font-weight:600;font-size:0.9rem;">URL Apps Script Web App:</label>
        <input type="url" class="input-answer" id="input-sync-url"
          placeholder="https://script.google.com/macros/s/.../exec"
          value="${escapeHtml(currentUrl)}"
          style="width:100%;margin:0.75rem 0;">
        <label style="font-weight:600;font-size:0.9rem;">Token (hasło dostępu):</label>
        <input type="password" class="input-answer" id="input-sync-token"
          placeholder="Twoje tajne hasło z Apps Script"
          value="${escapeHtml(getSyncToken())}"
          style="width:100%;margin:0.75rem 0;">
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-primary" id="btn-save-url" style="flex:1;">Zapisz</button>
          <button class="btn btn-secondary" id="btn-test-sync" style="flex:1;margin-top:0;">Testuj</button>
        </div>
        <div id="sync-test-result" style="margin-top:1rem;font-size:0.9rem;"></div>
        <hr style="margin:1.5rem 0;border:none;border-top:1px solid #e5e7eb;">
        <h2 style="text-align:left;font-size:1rem;">Jak skonfigurować?</h2>
        <ol style="font-size:0.85rem;color:#555;padding-left:1.25rem;line-height:1.6;">
          <li>Utwórz nowy arkusz Google Sheets</li>
          <li>Nazwij zakładkę <strong>Progress</strong></li>
          <li>W wierszu 1 wpisz: <code>wordId</code> | <code>level</code> | <code>nextReview</code> | <code>lastReview</code></li>
          <li>Otwórz <strong>Rozszerzenia → Apps Script</strong></li>
          <li>Wklej kod z pliku <code>google-apps-script.js</code></li>
          <li><strong>Zmień SECRET_TOKEN</strong> na własne hasło</li>
          <li>Kliknij <strong>Wdróż → Nowe wdrożenie</strong></li>
          <li>Typ: <strong>Aplikacja internetowa</strong>, Dostęp: <strong>Każdy</strong></li>
          <li>Skopiuj URL i wklej powyżej</li>
        </ol>
      </div>

      ${syncUrl ? '<button class="btn btn-secondary" id="btn-force-pull" style="margin-top:0.75rem;">Pobierz postęp z Sheets</button>' : ''}
      ${syncUrl ? '<button class="btn btn-secondary" id="btn-force-push" style="margin-top:0.75rem;">Wyślij postęp do Sheets</button>' : ''}
      <button class="btn btn-secondary" id="btn-back" style="margin-top:0.75rem;">← Wróć</button>
    </div>
  `;

  // Level toggle interaction
  document.querySelectorAll('#level-toggles .level-toggle').forEach(el => {
    el.addEventListener('click', (event) => {
      // Prevent native <label> behavior from toggling checkbox twice.
      event.preventDefault();
      const lvl = el.dataset.level;
      const checkbox = el.querySelector('input[type=checkbox]');
      checkbox.checked = !checkbox.checked;
      el.classList.toggle('level-toggle--active', checkbox.checked);
      el.querySelector('.level-check').textContent = checkbox.checked ? '✓' : '';
    });
  });

  document.getElementById('btn-save-levels').addEventListener('click', () => {
    const selected = [...document.querySelectorAll('#level-toggles input:checked')].map(c => c.dataset.level);
    if (selected.length === 0) {
      document.getElementById('level-warning').style.display = 'block';
      return;
    }
    document.getElementById('level-warning').style.display = 'none';
    activeLevels = selected;
    saveActiveLevels();
    if (syncUrl) pushSettingsToSheets();
    document.getElementById('btn-save-levels').textContent = '✓ Zapisano!';
    setTimeout(() => {
      if (document.getElementById('btn-save-levels'))
        document.getElementById('btn-save-levels').textContent = 'Zapisz poziomy';
    }, 2000);
  });

  document.getElementById('btn-save-url').addEventListener('click', () => {
    const url = document.getElementById('input-sync-url').value.trim();
    const token = document.getElementById('input-sync-token').value.trim();
    setSyncUrl(url);
    setSyncToken(token);
    document.getElementById('sync-test-result').innerHTML =
      '<span style="color:#166534;">✓ Zapisano URL i token</span>';
  });

  const btnSaveSupabase = document.getElementById('btn-save-supabase');
  if (btnSaveSupabase) {
    btnSaveSupabase.addEventListener('click', async () => {
      const url = document.getElementById('input-supabase-url').value.trim();
      const publishableKey = document.getElementById('input-supabase-publishable-key').value.trim();
      const resultEl = document.getElementById('supabase-config-result');

      if (!url || !publishableKey) {
        resultEl.innerHTML = '<span style="color:#991b1b;">Wpisz Project URL i publishable key.</span>';
        return;
      }

      setSupabaseUrl(url);
      setSupabasePublishableKey(publishableKey);
      resetSupabaseClient();
      try {
        await refreshSupabaseSession();
      } catch {}

      resultEl.innerHTML = '<span style="color:#166534;">✓ Zapisano konfigurację Supabase. Po logowaniu sesja będzie pamiętana.</span>';
      setAuthUiMessage('success', 'Konfiguracja Supabase zapisana. Możesz się teraz zalogować.');
    });
  }

  const btnTestSupabase = document.getElementById('btn-test-supabase');
  if (btnTestSupabase) {
    btnTestSupabase.addEventListener('click', async () => {
      const url = document.getElementById('input-supabase-url').value.trim();
      const publishableKey = document.getElementById('input-supabase-publishable-key').value.trim();
      const resultEl = document.getElementById('supabase-config-result');
      resultEl.innerHTML = '<span style="color:#555;">Testuję Supabase...</span>';

      try {
        const count = await testSupabaseConnection(url, publishableKey);
        resultEl.innerHTML = `<span style="color:#166534;">✓ Połączono z Supabase. Ranking ma obecnie ${count} rekordów.</span>`;
      } catch (error) {
        resultEl.innerHTML = `<span style="color:#991b1b;">✗ ${escapeHtml(formatAuthError(error, 'Nie udało się połączyć z Supabase.'))}</span>`;
      }
    });
  }

  const btnClearSupabase = document.getElementById('btn-clear-supabase');
  if (btnClearSupabase) {
    btnClearSupabase.addEventListener('click', () => {
      setSupabaseUrl('');
      setSupabasePublishableKey('');
      resetSupabaseClient();
      setAuthUiMessage('info', 'Usunięto lokalne nadpisanie konfiguracji Supabase.');
      renderSettings();
    });
  }

  const btnOpenAuthScreen = document.getElementById('btn-open-auth-screen');
  if (btnOpenAuthScreen) {
    btnOpenAuthScreen.addEventListener('click', () => {
      renderLogin();
    });
  }

  const btnSignoutSupabase = document.getElementById('btn-signout-supabase');
  if (btnSignoutSupabase) {
    btnSignoutSupabase.addEventListener('click', async () => {
      const client = getSupabaseClient();
      if (!client) {
        renderLogin();
        return;
      }
      await client.auth.signOut();
      resetSupabaseClient();
      setAuthUiMessage('info', 'Wylogowano z Supabase.');
      renderLogin();
    });
  }

  const btnImportLegacySupabase = document.getElementById('btn-import-legacy-supabase');
  if (btnImportLegacySupabase) {
    btnImportLegacySupabase.addEventListener('click', async () => {
      if (!hasLegacyDataForSupabaseImport()) return;

      btnImportLegacySupabase.disabled = true;
      btnImportLegacySupabase.textContent = 'Importuję...';

      await maybeBootstrapSupabasePlayer({ allowSkippedMarkerOverride: true, forceImport: true });
      await hydrateLocalStateFromSupabase();
      renderSettings();
    });
  }

  const btnClearIgnored = document.getElementById('btn-clear-ignored');
  if (btnClearIgnored) {
    btnClearIgnored.addEventListener('click', () => {
      if (!ignoredWordIds.length) return;
      if (!confirm('Czy na pewno chcesz przywrócić wszystkie ignorowane słówka?')) return;
      ignoredWordIds = [];
      saveIgnoredWordIds();
      if (syncUrl) pushSettingsToSheets();
      renderSettings();
    });
  }

  document.querySelectorAll('.btn-unignore-word').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = Number(btn.dataset.wordId);
      if (!Number.isFinite(id)) return;
      ignoredWordIds = ignoredWordIds.filter((wordId) => wordId !== id);
      saveIgnoredWordIds();
      if (syncUrl) pushSettingsToSheets();
      renderSettings();
    });
  });

  document.getElementById('btn-test-sync').addEventListener('click', async () => {
    const url = document.getElementById('input-sync-url').value.trim();
    const token = document.getElementById('input-sync-token').value.trim();
    const resultEl = document.getElementById('sync-test-result');
    if (!url) { resultEl.innerHTML = '<span style="color:#991b1b;">Wpisz URL</span>'; return; }
    if (!token) { resultEl.innerHTML = '<span style="color:#991b1b;">Wpisz token</span>'; return; }
    resultEl.innerHTML = '<span style="color:#555;">Testuję połączenie...</span>';
    try {
      const sep = url.includes('?') ? '&' : '?';
      const resp = await fetch(url + sep + 'token=' + encodeURIComponent(token));
      const data = await resp.json();
      if (data.ok) {
        const count = Object.keys(data.progress || {}).filter(k => k !== '_settings').length;
        resultEl.innerHTML = `<span style="color:#166534;">✓ Połączono! Znaleziono ${count} wpisów.</span>`;
      } else {
        resultEl.innerHTML = `<span style="color:#991b1b;">✗ Błąd: ${escapeHtml(data.error || 'nieznany')}</span>`;
      }
    } catch {
      resultEl.innerHTML = `<span style="color:#991b1b;">✗ Nie udało się połączyć.</span>`;
    }
  });

  const btnPull = document.getElementById('btn-force-pull');
  if (btnPull) {
    btnPull.addEventListener('click', async () => {
      btnPull.textContent = 'Pobieram...';
      btnPull.disabled = true;
      const remote = await pullFromSheets();
      if (remote) {
        progress = remote;
        saveProgress();

        if (isSupabaseAuthenticated()) {
          renderSettings();
          return;
        }

        btnPull.textContent = '✓ Pobrano!';
      } else {
        btnPull.textContent = '✗ Błąd pobierania';
      }
    });
  }

  const btnPush = document.getElementById('btn-force-push');
  if (btnPush) {
    btnPush.addEventListener('click', async () => {
      btnPush.textContent = 'Wysyłam...';
      btnPush.disabled = true;
      try {
        await fetch(syncUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: JSON.stringify({
            token: syncToken,
            progress: {
              ...progress,
              _settings: buildSettingsPayload()
            }
          })
        });
        btnPush.textContent = '✓ Wysłano!';
      } catch {
        btnPush.textContent = '✗ Błąd wysyłania';
      }
    });
  }

  document.getElementById('btn-back').addEventListener('click', renderHome);
}

// ===== UTILS =====
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== INIT =====
async function init() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
  const app = document.getElementById('app');
  progress = loadProgress();
  try {
    allWords = await loadWords();
  } catch {
    app.innerHTML = '<p style="text-align:center;color:red;padding:2rem;">Nie udało się załadować słówek.</p>';
    return;
  }

  if (syncUrl || isSupabaseAuthenticated()) {
    app.innerHTML = `
      <div class="sync-spinner">
        <div class="spinner-ring"></div>
        <span>Synchronizacja postępu...</span>
      </div>`;
  }

  // Always sync on load if configured — show spinner while waiting
  if (syncUrl) {
    const remote = await pullFromSheets();
    if (remote) {
      for (const [id, entry] of Object.entries(remote)) {
        const local = progress[id];
        if (!local || !local.lastReview || (entry.lastReview && entry.lastReview >= local.lastReview)) {
          progress[id] = entry;
        }
      }
      saveProgress();
    }
  }

  if (isSupabaseAuthenticated()) {
    await hydrateLocalStateFromSupabase();
  }

  renderHome();
  })();

  try {
    await initPromise;
  } finally {
    initPromise = null;
  }
}

// ===== LOGIN =====
function isAuthenticated() {
  if (hasSupabaseConfig()) return isSupabaseAuthenticated();
  return hasLegacySession();
}

function renderLogin() {
  currentScreen = 'login';
  const app = document.getElementById('app');
  const supabaseConfigured = hasSupabaseConfig();
  const message = authUiMessage;
  const currentSupabaseUrl = getSupabaseUrl();
  const currentSupabasePublishableKey = getSupabasePublishableKey();
  const supabaseLibraryReady = hasSupabaseLibrary();
  const showSupabaseConfigControls = shouldShowSupabaseConfigControls();
  const showLegacyFallback = !supabaseConfigured;
  const messageHtml = message
    ? `<p class="login-status login-status--${escapeHtml(message.type)}">${escapeHtml(message.text)}</p>`
    : '';

  app.innerHTML = `
    <div class="login-box">
      <div class="login-logo">🦛</div>
      <h1>Hippo Words</h1>
      <p class="login-subtitle">
        ${supabaseConfigured
          ? 'Zaloguj się magic linkiem wysłanym na e-mail. Sesja zapisze się na urządzeniu.'
          : 'Najpierw skonfiguruj Supabase Auth. Potem użytkownicy będą logować się normalnie, bez wspólnego hasła.'}
      </p>
      ${messageHtml}
      ${supabaseConfigured ? `
      <form id="magic-link-form" class="login-form-stack">
        <input
          id="login-email-input"
          type="email"
          class="input-answer login-email-input"
          placeholder="twoj@email.com"
          autocomplete="email"
          autofocus
        />
        <button class="btn btn-primary" type="submit">Wyślij magic link</button>
      </form>
      <p class="login-helper">Po kliknięciu linku z maila gra sama wykryje aktywną sesję po powrocie do aplikacji.</p>
      ` : `
      <div class="login-callout">
        Brak konfiguracji Supabase na tym urządzeniu. Wklej <strong>Project URL</strong> i <strong>publishable key</strong> z panelu Supabase albo wpisz je na stałe w pliku <strong>supabase-config.js</strong>.
      </div>
      `}

      ${supabaseLibraryReady ? '' : '<div class="login-callout" style="margin-top:1rem;background:#fef2f2;color:#991b1b;">Nie załadowała się biblioteka Supabase z CDN. Sprawdź połączenie z internetem i odśwież stronę.</div>'}

      ${showSupabaseConfigControls ? `
      <button type="button" class="btn btn-secondary auth-config-toggle" id="btn-toggle-auth-config">
        ${supabaseConfigured ? '⚙ Zmień konfigurację Supabase' : '⚙ Skonfiguruj Supabase'}
      </button>

      <div id="login-auth-config" class="auth-config-card" ${supabaseConfigured ? 'hidden' : ''}>
        <label class="settings-label">Project URL</label>
        <input
          id="input-login-supabase-url"
          type="url"
          class="input-answer"
          placeholder="https://twoj-projekt.supabase.co"
          value="${escapeHtml(currentSupabaseUrl)}"
        />
        <label class="settings-label" style="margin-top:0.85rem;">Publishable key</label>
        <textarea
          id="input-login-supabase-publishable-key"
          class="auth-textarea"
          placeholder="sb_publishable_xxxxx"
        >${escapeHtml(currentSupabasePublishableKey)}</textarea>
        <div class="auth-config-actions">
          <button type="button" class="btn btn-primary" id="btn-save-login-supabase">Zapisz konfigurację</button>
          <button type="button" class="btn btn-secondary" id="btn-test-login-supabase">Testuj połączenie</button>
        </div>
        ${hasSupabaseLocalOverride() ? '<button type="button" class="btn btn-secondary" id="btn-clear-login-supabase">Usuń lokalne nadpisanie</button>' : ''}
        <div id="login-config-result" class="auth-inline-result"></div>
        <p class="auth-config-note">
          ${getAuthRedirectUrl()
            ? `Redirect URL do wpisania w Supabase Auth: <strong>${escapeHtml(getAuthRedirectUrl())}</strong>`
            : 'Do testow lokalnych uruchom gre przez http://localhost albo GitHub Pages. Supabase Auth nie zadziala z file://.'}
        </p>
      </div>
      ` : ''}

      ${showLegacyFallback ? `
      <details class="legacy-login">
        <summary>Tryb awaryjny: stare hasło lokalne</summary>
        <form id="login-form" class="login-form-stack">
          <input
            id="login-input"
            type="password"
            placeholder="hasło"
            autocomplete="current-password"
          />
          <button type="submit" class="btn btn-secondary">Wejdź hasłem</button>
          <p id="login-error" class="login-error" hidden>Złe hasło, spróbuj jeszcze raz 🙈</p>
        </form>
      </details>
      ` : ''}
    </div>
  `;

  const btnToggleAuthConfig = document.getElementById('btn-toggle-auth-config');
  const loginAuthConfig = document.getElementById('login-auth-config');
  if (btnToggleAuthConfig && loginAuthConfig) {
    btnToggleAuthConfig.addEventListener('click', () => {
      loginAuthConfig.hidden = !loginAuthConfig.hidden;
    });
  }

  const btnSaveLoginSupabase = document.getElementById('btn-save-login-supabase');
  if (btnSaveLoginSupabase) {
    btnSaveLoginSupabase.addEventListener('click', async () => {
      const url = document.getElementById('input-login-supabase-url').value.trim();
      const publishableKey = document.getElementById('input-login-supabase-publishable-key').value.trim();
      const resultEl = document.getElementById('login-config-result');

      if (!url || !publishableKey) {
        resultEl.innerHTML = '<span style="color:#991b1b;">Wpisz Project URL i publishable key.</span>';
        return;
      }

      setSupabaseUrl(url);
      setSupabasePublishableKey(publishableKey);
      resetSupabaseClient();
      try {
        await refreshSupabaseSession();
      } catch {}
      setAuthUiMessage('success', 'Konfiguracja Supabase zapisana. Możesz się zalogować.');
      renderLogin();
    });
  }

  const btnTestLoginSupabase = document.getElementById('btn-test-login-supabase');
  if (btnTestLoginSupabase) {
    btnTestLoginSupabase.addEventListener('click', async () => {
      const url = document.getElementById('input-login-supabase-url').value.trim();
      const publishableKey = document.getElementById('input-login-supabase-publishable-key').value.trim();
      const resultEl = document.getElementById('login-config-result');
      resultEl.innerHTML = '<span style="color:#555;">Testuję Supabase...</span>';

      try {
        const count = await testSupabaseConnection(url, publishableKey);
        resultEl.innerHTML = `<span style="color:#166534;">✓ Połączono z Supabase. Ranking ma obecnie ${count} rekordów.</span>`;
      } catch (error) {
        resultEl.innerHTML = `<span style="color:#991b1b;">✗ ${escapeHtml(formatAuthError(error, 'Nie udało się połączyć z Supabase.'))}</span>`;
      }
    });
  }

  const btnClearLoginSupabase = document.getElementById('btn-clear-login-supabase');
  if (btnClearLoginSupabase) {
    btnClearLoginSupabase.addEventListener('click', () => {
      setSupabaseUrl('');
      setSupabasePublishableKey('');
      resetSupabaseClient();
      setAuthUiMessage('info', 'Usunięto lokalne nadpisanie konfiguracji Supabase.');
      renderLogin();
    });
  }

  if (supabaseConfigured) {
    const magicLinkForm = document.getElementById('magic-link-form');
    if (magicLinkForm) {
      magicLinkForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email-input').value.trim();
        if (!email) {
          setAuthUiMessage('error', 'Wpisz adres e-mail.');
          renderLogin();
          return;
        }

        const submitButton = magicLinkForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Wysyłam...';

        try {
          if (!isHttpOrigin()) {
            throw new Error('Supabase Auth wymaga uruchomienia przez http://localhost albo GitHub Pages, nie przez file://.');
          }
          const client = getSupabaseClient();
          if (!client) throw new Error('Brak konfiguracji Supabase Auth.');
          const { error } = await client.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: getAuthRedirectUrl()
            }
          });
          if (error) throw error;
          setAuthUiMessage('success', `Wysłano magic link na ${email}. Otwórz maila i wróć do gry.`);
        } catch (error) {
          setAuthUiMessage('error', formatAuthError(error, 'Nie udało się wysłać magic linku.'));
        }

        renderLogin();
      });
    }

  }

  const legacyLoginForm = document.getElementById('login-form');
  if (legacyLoginForm) {
    legacyLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const val = document.getElementById('login-input').value;
      if (val === ACCESS_PASSWORD) {
        sessionStorage.setItem(AUTH_KEY, '1');
        init();
      } else {
        const err = document.getElementById('login-error');
        err.hidden = false;
        document.getElementById('login-input').value = '';
        document.getElementById('login-input').focus();
      }
    });
  }
}

async function boot() {
  currentScreen = 'boot';

  if (hasSupabaseConfig()) {
    try {
      const session = await refreshSupabaseSession();
      if (session) {
        await init();
        return;
      }
    } catch (error) {
      console.error(error);
      setAuthUiMessage('error', 'Nie udało się połączyć z Supabase Auth. Sprawdź Project URL i publishable key.');
    }

    renderLogin();
    return;
  }

  if (hasLegacySession()) {
    await init();
    return;
  }

  renderLogin();
}

boot();
