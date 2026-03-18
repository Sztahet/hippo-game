// ===== CONSTANTS =====
const INTERVALS = [0, 1, 3, 7, 14, 30, 90, 180, 730]; // days per level
const SESSION_SIZE = 25;
const STORAGE_KEY = 'vocab_progress';
const SYNC_URL_KEY = 'vocab_sync_url';
const SYNC_TOKEN_KEY = 'vocab_sync_token';
const ACTIVE_LEVELS_KEY = 'vocab_active_levels';
const IGNORED_WORD_IDS_KEY = 'vocab_ignored_word_ids';
const DAILY_STATS_KEY = 'vocab_daily_stats';

const ALL_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const LEVEL_DESCRIPTIONS = {
  A1: 'Podstawy (985 słów)',
  A2: 'Elementarny',
  B1: 'Średniozaawansowany',
  B2: 'Wyższy średni',
  C1: 'Zaawansowany',
  C2: 'Biegły',
};

// ===== ACCESS PASSWORD =====
// Zmień to hasło na coś własnego!
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

  const options = [primaryEn, ...uniquePool.slice(0, 14)];

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
  const stats = getStats();
  const recent = getRecentDailyStats(10);
  const streak = getCurrentStreak();
  const maxSessions = Math.max(1, ...recent.rows.map(r => r.sessions));
  const dailyBars = recent.rows.map(r => {
    const sessionsHeight = Math.max(4, Math.round((r.sessions / maxSessions) * 100));
    const scoreHeight = Math.max(4, Math.round(r.avgPct));
    return `
      <div class="daily-bar-wrap" title="${r.date}: ${r.sessions} sesji, ${r.avgPct}%">
        <div class="daily-bar-score" style="height:${scoreHeight}%;"></div>
        <div class="daily-bar-sessions" style="height:${sessionsHeight}%;"></div>
        <div class="daily-bar-label">${r.label}</div>
      </div>
    `;
  }).join('');
  app.innerHTML = `
    <div class="screen">
      <h1>Nauka Słówek PL → EN</h1>
      <div class="stats">
        <div class="stat-box">
          <div class="stat-number">${stats.dueCount}</div>
          <div class="stat-label">Do powtórki</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${stats.newCount}</div>
          <div class="stat-label">Nowych</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${stats.masteredCount}</div>
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
        <div class="streak-row">Seria: <strong>${streak}</strong> dni z rzędu</div>
        <div class="daily-bars">${dailyBars}</div>
        <div class="daily-legend">
          <span><i class="legend-dot legend-dot-sessions"></i> liczba sesji</span>
          <span><i class="legend-dot legend-dot-score"></i> średni wynik %</span>
        </div>
      </div>
      ${stats.dueCount + stats.newCount > 0
        ? '<button class="btn btn-primary" id="btn-start">Zacznij sesję</button>'
        : '<p style="text-align:center;color:#888;">Brak słówek do nauki na dziś. Wróć jutro!</p>'
      }
      <div id="sync-indicator" class="sync-indicator"></div>
      <button class="btn btn-secondary" id="btn-settings">⚙ Ustawienia synchronizacji</button>
      <button class="btn btn-secondary" id="btn-reset">Resetuj postęp</button>
    </div>
  `;

  updateSyncIndicator();

  const btnStart = document.getElementById('btn-start');
  if (btnStart) {
    btnStart.addEventListener('click', startSession);
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
  const word = session[currentIndex];
  const pct = Math.round((currentIndex / session.length) * 100);
  const isHintMode = mode === 'hint';
  const hintChoices = isHintMode ? getHintChoices(word) : [];

  app.innerHTML = `
    <div class="screen">
      <div class="progress-text">${currentIndex + 1} / ${session.length}</div>
      <div class="progress-bar-container">
        <div class="progress-bar" style="width:${pct}%"></div>
      </div>
      <div class="card">
        <div class="word-pl">${escapeHtml(word.pl)}</div>
        <div class="word-hint">${isHintMode ? 'Wybierz poprawne tłumaczenie (tryb podpowiedzi)' : 'Wpisz tłumaczenie po angielsku'}</div>
        <div class="input-group" ${isHintMode ? 'style="display:none;"' : ''}>
          <input type="text" class="input-answer" id="input-answer" autocomplete="off" ${isHintMode ? '' : 'autofocus'}>
          <button class="btn-submit" id="btn-check">→</button>
        </div>
        ${isHintMode ? `
        <div class="hint-options" id="hint-options">
          ${hintChoices.map((choice, idx) => `
            <button class="hint-option-btn" data-choice-index="${idx}">${escapeHtml(choice)}</button>
          `).join('')}
        </div>
        ` : '<button class="btn btn-secondary" id="btn-hint" style="margin-top:0.75rem;">Podpowiedź (15 opcji)</button>'}
      </div>
    </div>
  `;

  if (!isHintMode) {
    const input = document.getElementById('input-answer');
    const btnCheck = document.getElementById('btn-check');
    const btnHint = document.getElementById('btn-hint');

    input.focus();

    const submit = () => {
      const answer = input.value;
      if (!answer.trim()) return;
      const status = checkAnswer(answer, word);
      sessionResults.push({ wordId: word.id, status, userAnswer: answer, correctAnswer: getEnAllDisplay(word), pl: word.pl, mode: 'typed' });
      advanceLevel(word.id, status);
      renderFeedback(word, status, answer);
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    btnCheck.addEventListener('click', submit);
    btnHint.addEventListener('click', () => renderCard('hint'));
    return;
  }

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
}

function renderFeedback(word, status, userAnswer) {
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
    text = 'Błąd w trybie podpowiedzi — resetuję poziom';
  } else if (status === 'typo') {
    icon = '~';
    cls = 'feedback-typo';
    text = 'Literówka — cofam o 1 poziom';
  } else {
    icon = '✗';
    cls = 'feedback-wrong';
    text = 'Źle — resetuję poziom';
  }

  app.innerHTML = `
    <div class="screen">
      <div class="progress-text">${currentIndex + 1} / ${session.length}</div>
      <div class="feedback ${cls}">
        <div class="feedback-icon">${icon}</div>
        <div class="feedback-text">${text}</div>
        <div class="feedback-answer">${escapeHtml(getEnAllDisplay(word))}</div>
        ${status !== 'correct' ? `<div class="feedback-text" style="margin-top:0.5rem;">Twoja odpowiedź: <strong>${escapeHtml(userAnswer)}</strong></div>` : ''}
      </div>
    </div>
  `;

  setTimeout(() => {
    currentIndex++;
    if (currentIndex < session.length) {
      renderCard();
    } else {
      renderSummary();
    }
  }, status === 'correct' ? 1000 : 2000);
}

function renderSummary() {
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
    const dotClass = (r.status === 'correct' || r.status === 'hint-correct') ? 'dot-correct' : r.status === 'typo' ? 'dot-typo' : 'dot-wrong';
    const statusLabel = r.status === 'hint-correct'
      ? '<span class="word-result-note">(podpowiedź: bez awansu)</span>'
      : r.status === 'hint-wrong'
        ? '<span class="word-result-note">(podpowiedź: reset)</span>'
        : '';
    const isIgnored = ignoredSet.has(Number(r.wordId));
    return `
      <div class="word-result">
        <div style="display:flex;align-items:center;">
          <div class="word-result-status ${dotClass}"></div>
          <span>${escapeHtml(r.pl)} ${statusLabel}</span>
        </div>
        <div class="word-result-right">
          <span>${escapeHtml(r.correctAnswer)}</span>
          <button class="btn-ignore-word" data-word-id="${r.wordId}" ${isIgnored ? 'disabled' : ''}>
            ${isIgnored ? 'Ignorowane' : 'Ignoruj'}
          </button>
        </div>
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

  document.getElementById('btn-home').addEventListener('click', renderHome);
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
  const currentUrl = getSyncUrl();
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
  const app = document.getElementById('app');
  progress = loadProgress();
  try {
    allWords = await loadWords();
  } catch {
    app.innerHTML = '<p style="text-align:center;color:red;padding:2rem;">Nie udało się załadować słówek.</p>';
    return;
  }

  // Always sync on load if configured — show spinner while waiting
  if (syncUrl) {
    app.innerHTML = `
      <div class="sync-spinner">
        <div class="spinner-ring"></div>
        <span>Synchronizacja postępu…</span>
      </div>`;
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

  renderHome();
}

// ===== LOGIN =====
function isAuthenticated() {
  return sessionStorage.getItem(AUTH_KEY) === '1';
}

function renderLogin() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="login-box">
      <div class="login-logo">🦛</div>
      <h1>Hippo Words</h1>
      <p class="login-subtitle">Wpisz hasło, żeby zacząć</p>
      <form id="login-form">
        <input
          id="login-input"
          type="password"
          placeholder="hasło"
          autocomplete="current-password"
          autofocus
        />
        <button type="submit">Wejdź</button>
        <p id="login-error" class="login-error" hidden>Złe hasło, spróbuj jeszcze raz 🙈</p>
      </form>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', e => {
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

if (isAuthenticated()) {
  init();
} else {
  renderLogin();
}
