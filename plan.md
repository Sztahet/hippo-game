# Plan projektu Hippo Words

To już nie jest prototyp oparty wyłącznie o `localStorage`. Aktualny projekt to statyczna aplikacja webowa z frontendem w vanilla JS i backendem w Supabase. Celem produktu jest nauka słówek PL → EN metodą spaced repetition z prywatnym profilem gracza, możliwością odzyskania stanu na nowym urządzeniu oraz publicznym snapshotem statystyk do porównań.

## Główne założenia

- frontend pozostaje prosty: `index.html`, `app.js`, `style.css`,
- słownictwo dalej jest wersjonowane w repo przez `words.json`,
- auth i synchronizacja przechodzą do Supabase,
- `localStorage` ma być lokalnym cachem, a nie trwałym źródłem prawdy,
- Google Sheets ma zostać wygaszony po zakończeniu migracji użytkowników.

## Komponenty systemu

- `index.html` - entrypoint i ładowanie klienta Supabase.
- `app.js` - logika sesji, auth, synchronizacji i UI.
- `style.css` - warstwa wizualna.
- `words.json` - słownik słówek z poziomami CEFR.
- `supabase-config.js` - publiczna konfiguracja projektu Supabase.
- `supabase/migrations/*.sql` - kontrakt backendu danych.
- `google-apps-script.js` - warstwa legacy do odzyskiwania starych danych.

## Model produktu

### Sesja nauki

1. Użytkownik startuje sesję z puli słów due + nowych.
2. Odpowiedź aktualizuje poziom słowa i daty powtórki.
3. Po zakończeniu sesji aktualizowane są daily stats.
4. Lokalny stan zapisuje się od razu, a pełny stały sync do Supabase pozostaje celem docelowym; obecnie aktywny jest przede wszystkim jednorazowy import legacy danych.

### Konto użytkownika

1. User loguje się magic linkiem Supabase.
2. Dla usera powstaje rekord `players`.
3. Frontend pobiera snapshot ustawień i progressu.
4. Zmiany mają trafiać do Supabase bez ręcznej konfiguracji przez końcowego użytkownika.

### Publiczne porównania

1. Surowe dane użytkownika zostają prywatne.
2. Ranking i porównania opierają się na `player_public_stats`.
3. Publiczny widok nie powinien czytać bezpośrednio z `player_daily_stats` ani `player_word_progress`.

## Algorytm SRS

| Poziom | Interwał |
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

- Poprawna odpowiedź zwiększa poziom.
- Literówka zmniejsza poziom o 1.
- Błąd resetuje poziom do 0.

## Docelowy model danych

### W repo

- `words.json` - wersjonowana treść edukacyjna.

### W Supabase

- `players` - tożsamość gracza,
- `player_settings` - aktywne poziomy i ignorowane słówka,
- `player_daily_stats` - statystyki per dzień,
- `player_word_progress` - stan SRS per słowo,
- `player_public_stats` - publiczny snapshot.

### Lokalnie

- `localStorage` - cache runtime, bootstrap starego stanu, offline buffer.

## Ograniczenia architektoniczne

- Auth wymaga HTTP, więc `file://` nie jest wspieranym środowiskiem testowym.
- Frontend liczy część danych po stronie klienta, więc ranking opiera się na zaufaniu.
- Sync do backendu musi być best-effort: użytkownik ma móc dokończyć sesję nawet przy chwilowym błędzie sieci.

## Kryteria sukcesu projektu

- user loguje się tylko przez Supabase,
- stan można odzyskać na nowym urządzeniu bez Google Sheets,
- po sesji aktualizują się zarówno daily stats, jak i progress słówek,
- publiczne porównania działają bez ujawniania surowych danych innych użytkowników,
- legacy storage nie komplikuje już głównego flow produktu.

## Poza zakresem na dziś

- wieloosobowy leaderboard z silnym anti-cheat,
- pełna offline-first kolejka synchronizacji z rozwiązywaniem konfliktów serwerowych,
- wiele niezależnych profili lokalnych na jednym urządzeniu,
- rozbudowane funkcje społecznościowe wykraczające poza porównanie statystyk.
