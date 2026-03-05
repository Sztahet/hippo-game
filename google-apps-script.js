/**
 * Google Apps Script — backend do synchronizacji postępu nauki słówek.
 *
 * INSTRUKCJA KONFIGURACJI:
 * 1. Otwórz Google Sheets → utwórz nowy arkusz
 * 2. Nazwij pierwszy arkusz (zakładkę): "Progress"
 * 3. W wierszu 1 wpisz nagłówki: wordId | level | nextReview | lastReview
 * 4. Otwórz menu: Rozszerzenia → Apps Script
 * 5. Wklej cały ten kod (zastąp zawartość Code.gs)
 * 6. ZMIEŃ SECRET_TOKEN poniżej na własne, unikalne hasło!
 * 7. Kliknij: Wdróż → Nowe wdrożenie
 *    - Typ: Aplikacja internetowa (Web app)
 *    - Wykonaj jako: Ja (Twoje konto)
 *    - Kto ma dostęp: Każdy (Anyone)
 * 8. Skopiuj URL wdrożenia i wklej go w ustawieniach aplikacji
 *
 * WAŻNE: Po każdej zmianie kodu musisz zrobić NOWE wdrożenie (nie "edytuj istniejące").
 * WAŻNE: Zmień SECRET_TOKEN na coś unikalnego! To samo hasło wpisujesz w aplikacji.
 */

// ▼▼▼ ZMIEŃ TO HASŁO! ▼▼▼
const SECRET_TOKEN = 'zmien-mnie-na-cos-trudnego-123';
// ▲▲▲ ZMIEŃ TO HASŁO! ▲▲▲

const SHEET_NAME = 'Progress';

function getSheet() {
  return SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
}

function unauthorized() {
  return ContentService
    .createTextOutput(JSON.stringify({ ok: false, error: 'Unauthorized — nieprawidłowy token' }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET — zwraca cały postęp jako JSON
 */
function doGet(e) {
  // Sprawdź token
  const token = (e.parameter && e.parameter.token) || '';
  if (token !== SECRET_TOKEN) return unauthorized();

  try {
    const sheet = getSheet();
    const data = sheet.getDataRange().getValues();
    const progress = {};

    // Pomijamy wiersz nagłówkowy (i=0)
    for (let i = 1; i < data.length; i++) {
      const [wordId, level, nextReview, lastReview] = data[i];
      if (!wordId) continue;
      const key = String(wordId);
      if (key === '_settings') {
        // Special row: level column holds either legacy levels array JSON
        // or a settings object JSON, nextReview column can hold ignored IDs JSON.
        progress['_settings'] = {
          activeLevels: String(level || '[]'),
          ignoredWordIds: String(nextReview || '[]')
        };
      } else {
        progress[key] = {
          level: Number(level),
          nextReview: String(nextReview),
          lastReview: String(lastReview)
        };
      }
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, progress }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * POST — zapisuje/aktualizuje postęp
 * Body: { progress: { "1": { level, nextReview, lastReview }, ... } }
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Sprawdź token
    if (body.token !== SECRET_TOKEN) return unauthorized();

    const incoming = body.progress;
    const sheet = getSheet();

    // Wczytaj istniejące dane do mapy wordId → numer wiersza
    const data = sheet.getDataRange().getValues();
    const rowMap = {};
    for (let i = 1; i < data.length; i++) {
      if (data[i][0]) {
        rowMap[String(data[i][0])] = i + 1; // 1-indexed w Sheets
      }
    }

    // Aktualizuj lub dodaj wpisy
    const newRows = [];
    for (const [wordId, entry] of Object.entries(incoming)) {
      let row;
      if (wordId === '_settings') {
        // Settings row: store app settings JSON chunks in dedicated columns.
        row = ['_settings', entry.activeLevels || '[]', entry.ignoredWordIds || '[]', ''];
      } else {
        row = [Number(wordId), entry.level, entry.nextReview, entry.lastReview || ''];
      }
      if (rowMap[wordId]) {
        sheet.getRange(rowMap[wordId], 1, 1, 4).setValues([row]);
      } else {
        newRows.push(row);
      }
    }

    // Dodaj nowe wiersze na końcu
    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, 4).setValues(newRows);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, updated: Object.keys(incoming).length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
