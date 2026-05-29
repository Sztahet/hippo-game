# Hippo Words

Hippo Words to statyczna aplikacja do nauki słówek PL → EN metodą spaced repetition. Runtime używa Supabase Auth do logowania, bootstrappuje profil gracza w bazie, odtwarza lokalny stan z prywatnego snapshotu i synchronizuje bieżący snapshot do Supabase po zakończonej sesji oraz po zmianach ustawień.

**Live:** https://sztahet.github.io/hippo-game/

## Status projektu

- Logowanie działa przez Supabase Auth. Dla nowego adresu pierwszy mail to `Confirm signup`, a kolejne wejścia używają `Magic Link`.
- Frontend po odzyskaniu sesji wywołuje `bootstrap_player_from_auth({})`, żeby zapewnić rekord `players` dla zalogowanego usera.
- Aplikacja pobiera `get_my_player_snapshot()` i na tej podstawie hydratyzuje lokalny stan gry.
- Publiczne porównania mają czytać wyłącznie z `player_public_stats`.
- Główny flow logowania i uruchomienia aplikacji jest już uproszczony do jednego wariantu auth.
- Po zakończonej sesji i po zmianach ustawień frontend zapisuje pełny snapshot gracza do Supabase.

## Mapa dokumentacji

- `README.md` - aktualny model działania aplikacji i setup projektu.
- `supabase/README.md` - backend Supabase, migracje, Auth i kontrakt runtime.
- `plan.md` - produktowe założenia i kierunek architektury.
- `what_next.md` - najbliższy roadmap wdrożeniowy.
- `supabase/migration-plan.md` - krótka notatka o zamknięciu cutoveru i kolejnych krokach technicznych.

## Najważniejsze funkcje

- 9 poziomów SRS od nowych słów do interwału dwuletniego.
- Baza około 10 000 słów w poziomach CEFR A1-C2.
- Sesje nauki, feedback po każdej odpowiedzi i dzienne statystyki lokalne.
- Publiczny snapshot statystyk przygotowany pod ranking i porównania graczy.
- Login mailowy bez hasła aplikacyjnego po stronie użytkownika.
- Mobile-first UI działające na GitHub Pages.

## Architektura runtime

### Frontend

- `index.html` - entrypoint aplikacji i ładowanie klienta Supabase.
- `app.js` - logika runtime: sesje, auth, stan lokalny, statystyki i UI.
- `style.css` - warstwa wizualna.
- `words.json` - baza słówek.
- `supabase-config.js` - publiczny config projektu Supabase (`url` + `publishableKey`).

### Warstwy danych

- **Supabase** - auth, bootstrap profilu gracza, prywatny snapshot stanu i publiczny snapshot statystyk.
- **localStorage** - lokalny cache runtime używany do szybkiego renderu i pracy w trakcie sesji.

### Aktualny flow aplikacji

1. Aplikacja ładuje słówka i lokalny cache z `localStorage`.
2. Jeśli istnieje sesja Supabase, frontend ją odświeża i wywołuje `bootstrap_player_from_auth({})`.
3. Frontend pobiera `get_my_player_snapshot()` i odbudowuje lokalny stan gry.
4. UI działa na lokalnym cache'u podczas sesji nauki.
5. Po zakończonej sesji i po zmianie ustawień frontend synchronizuje pełny snapshot gracza do Supabase.
6. Publiczne porównania powinny czytać wyłącznie z `player_public_stats`.

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

## Najważniejsze pliki w repo

- `index.html`, `app.js`, `style.css`, `words.json` - runtime aplikacji.
- `supabase/current-schema.sql` - kanoniczny snapshot aktualnego backendu do fresh setupu i audytu SQL.
- `supabase/README.md` - setup i kontrakt backendu.
- `supabase/email-templates/` - szablony maili `Confirm signup` i `Magic Link`.
- `supabase/migrations/` - historia zmian backendu i inkrementalne migracje.
- `plan.md` - założenia produktu.
- `what_next.md` - najbliższe zadania.

## Lokalny development

Auth i redirecty wymagają uruchomienia po HTTP. `file://` nie nadaje się do testów logowania mailowego.

```powershell
# Node.js
npx serve .

# albo Python
python -m http.server 8080
```

Potem otwórz `http://localhost:3000` albo `http://localhost:8080`.

## Setup Supabase

1. Załóż projekt w Supabase.
2. Dla pustego projektu uruchom `supabase/current-schema.sql`.
3. `supabase/migrations/` traktuj jako historię zmian i nowe poprawki dla już istniejących środowisk.
4. W `Authentication -> URL Configuration` ustaw `Site URL` i `Redirect URLs` dla localhosta i GitHub Pages.
5. W `Authentication -> Email Templates` ustaw własne szablony dla `Confirm signup` i `Magic Link`.
6. Wpisz `url` i `publishableKey` do `supabase-config.js`.
7. Przetestuj logowanie nowym i istniejącym adresem e-mail.
8. Zweryfikuj, że w bazie istnieją tabele `players`, `player_settings`, `player_daily_stats`, `player_word_progress` i `player_public_stats`.

Szczegóły operacyjne są opisane w `supabase/README.md`.

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

- `localStorage` nadal jest aktywnym cachem runtime podczas sesji.
- Strategia retry i konfliktów dla równoległych zmian lokalnych i zdalnych wymaga jeszcze dopracowania.
- Auth wymaga uruchomienia aplikacji po HTTP.

## Szybka walidacja po zmianach

```powershell
node --check .\app.js
```

Do smoke testów UI uruchom lokalny serwer HTTP i sprawdź logowanie, zapis po zakończonej sesji oraz odtworzenie stanu po odświeżeniu.

## Stack techniczny

- Vanilla JavaScript
- CSS bez frameworka
- Supabase Auth + Postgres
- GitHub Pages
