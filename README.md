# Hippo Words

Hippo Words to statyczna aplikacja do nauki słówek PL → EN metodą spaced repetition. Projekt jest w trakcie przejścia z modelu legacy (`localStorage` + Google Sheets Apps Script) do modelu Supabase-first. Docelowo Supabase ma być jedynym backendem synchronizacji, odzyskiwania stanu i publicznych statystyk, a `localStorage` ma zostać tylko lokalnym cachem i buforem offline.

**Live:** https://sztahet.github.io/hippo-game/

## Status projektu

- Logowanie działa przez Supabase Auth i magic link wysyłany na e-mail.
- Supabase przechowuje profil gracza, ustawienia, dzienne statystyki, progress słówek i publiczny snapshot statystyk.
- Po starcie aplikacja potrafi zassać prywatny snapshot z Supabase i odtworzyć lokalny stan.
- Supabase służy obecnie w runtime głównie do logowania, odczytu snapshotu i jednorazowego importu legacy danych z localStorage albo Google Sheets.
- `localStorage` nadal jest używany przez runtime jako natychmiastowy stan UI i warstwa kompatybilności.
- Google Sheets nadal istnieje jako legacy bridge dla starych danych, ale nie jest docelowym backendem.

## Mapa dokumentacji

- `README.md` - overview projektu, setup i aktualny model działania.
- `supabase/README.md` - backend Supabase, migracje, Auth, operacje i recovery.
- `supabase/migration-plan.md` - plan pełnego odejścia od Sheets i redukcji roli `localStorage`.
- `plan.md` - produktowe założenia i architektura docelowa.
- `what_next.md` - najbliższy roadmap wdrożeniowy.

## Najważniejsze funkcje

- 9 poziomów SRS od nowych słów do interwału dwuletniego.
- Baza około 10 000 słów w poziomach CEFR A1-C2.
- Sesje nauki, feedback po każdej odpowiedzi i dzienne statystyki.
- Publiczny snapshot statystyk przygotowany pod przyszły ranking i porównania graczy.
- Magic link login bez hasła aplikacyjnego po stronie użytkownika.
- Mobile-first UI działające na GitHub Pages.

## Architektura runtime

### Frontend

- `index.html` - entrypoint aplikacji i ładowanie klienta Supabase.
- `app.js` - cała logika runtime: sesje, auth, sync, statystyki i UI.
- `style.css` - styl aplikacji.
- `words.json` - baza słówek.
- `supabase-config.js` - publiczny config projektu Supabase (`url` + `publishableKey`).

### Warstwy danych

- **Supabase** - docelowe źródło prawdy dla profilu gracza, statystyk dziennych, progressu słówek i publicznego snapshotu.
- **localStorage** - lokalny cache i warstwa przejściowa używana do szybkiego renderu oraz odzyskiwania starego stanu.
- **Google Sheets** - legacy sync dla starszych urządzeń i ręcznego odzyskiwania danych w okresie przejściowym.

### Aktualny flow aplikacji

1. Aplikacja ładuje słówka i lokalny stan z `localStorage`.
2. Jeśli użytkownik ma skonfigurowane Google Sheets, może zostać zassany legacy stan z Apps Script.
3. Jeśli istnieje aktywna sesja Supabase, aplikacja może jednorazowo przenieść legacy dane z tego urządzenia do Supabase.
4. Po imporcie aplikacja pobiera snapshot prywatnych danych z Supabase i odbudowuje lokalny stan.
5. Publiczne porównania powinny czytać wyłącznie z `player_public_stats`.

## Poziomy SRS

| Poziom | Następna powtórka |
| --- | --- |
| 0 | następna sesja |
| 1 | 1 dzień |
| 2 | 3 dni |
| 3 | 7 dni |
| 4 | 14 dni |
| 5 | 30 dni |
| 6 | 90 dni |
| 7 | 180 dni |
| 8 | około 2 lata |

- Poprawna odpowiedź podnosi poziom o 1.
- Literówka obniża poziom o 1.
- Błędna odpowiedź resetuje poziom do 0.

## Struktura repo

```text
hippo-game/
├── index.html
├── app.js
├── style.css
├── words.json
├── supabase-config.js
├── google-apps-script.js
├── supabase/
│   ├── README.md
│   ├── migration-plan.md
│   ├── generate_import_sql.js
│   └── migrations/
├── assets/
├── build.js
├── generate_words.py
├── generate_words_v2.js
├── generate_words_extension.js
├── words_20k_pipeline.js
├── plan.md
└── what_next.md
```

## Lokalny development

Auth i redirecty wymagają uruchomienia po HTTP. `file://` nie nadaje się do testów magic linka.

```powershell
# Node.js
npx serve .

# albo Python
python -m http.server 8080
```

Potem otwórz `http://localhost:3000` albo `http://localhost:8080`.

## Setup Supabase

1. Załóż projekt w Supabase.
2. Uruchom migracje z katalogu `supabase/migrations/` w kolejności nazw plików.
3. W Supabase Auth ustaw `Site URL` i `Redirect URLs` dla localhosta i GitHub Pages.
4. Wpisz `url` i `publishableKey` do `supabase-config.js`.
5. Przetestuj logowanie magic linkiem.
6. Zweryfikuj, że w bazie istnieją tabele `players`, `player_settings`, `player_daily_stats`, `player_word_progress` i `player_public_stats`.

Szczegóły operacyjne są opisane w `supabase/README.md`.

## Legacy Google Sheets

`google-apps-script.js` zostaje w repo wyłącznie jako wsparcie przejściowe:

- odzyskanie starych danych z urządzeń, które jeszcze żyją na Sheets,
- ręczny import w okresie przejściowym,
- awaryjny fallback zanim Supabase-only flow zostanie domknięty.

Nie rozwijamy już Google Sheets jako docelowego backendu.

## Dodawanie słówek

```powershell
node words_20k_pipeline.js --clean-only --import-start-id=3327
node words_20k_pipeline.js --target=3000 --import-start-id=3327
node words_20k_pipeline.js --consume-all --import-start-id=3327
```

Po zmianach w `words.json` wystarczy commit i push na GitHub Pages.

## Bundle offline

```powershell
node build.js
```

Bundle jest opcjonalny. Produkcyjny deployment opiera się na `index.html`, `app.js`, `style.css` i `words.json`.

## Aktualne ograniczenia

- Runtime nadal używa `localStorage` jako warstwy lokalnej i kompatybilności.
- Google Sheets może jeszcze wpływać na startowy stan użytkownika, jeśli jest skonfigurowany.
- Bieżąca wersja runtime traktuje Supabase głównie jako auth, odczyt snapshotu i jednorazowy import legacy danych, a nie pełny live sync po każdej sesji.

## Szybka walidacja po zmianach

```powershell
node --check .\app.js
```

Do smoke testów UI uruchom lokalny serwer HTTP i sprawdź logowanie, start sesji i zapis statystyk.

## Stack techniczny

- Vanilla JavaScript
- CSS bez frameworka
- Supabase Auth + Postgres
- GitHub Pages
- Google Apps Script wyłącznie jako legacy bridge
