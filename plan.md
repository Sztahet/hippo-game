# Plan projektu Hippo Words

Hippo Words to statyczna aplikacja webowa z frontendem w vanilla JS i backendem w Supabase. Celem produktu jest nauka słówek PL → EN metodą spaced repetition z prywatnym profilem gracza, możliwością odzyskania stanu po zalogowaniu i publicznym snapshotem statystyk do porównań.

## Główne założenia

- frontend pozostaje prosty: `index.html`, `app.js`, `style.css`,
- słownictwo dalej jest wersjonowane w repo przez `words.json`,
- logowanie i tożsamość gracza są obsługiwane przez Supabase,
- stan po zalogowaniu ma dać się odtworzyć z prywatnego snapshotu Supabase,
- `localStorage` ma być szybkim cachem UI, a nie długoterminowym źródłem prawdy.

## Komponenty systemu

- `index.html` - entrypoint i ładowanie klienta Supabase.
- `app.js` - logika sesji, auth, lokalnego stanu i UI.
- `style.css` - warstwa wizualna.
- `words.json` - słownik słówek z poziomami CEFR.
- `supabase-config.js` - publiczna konfiguracja projektu Supabase.
- `supabase/migrations/*.sql` - schema tabel i RPC backendu.
- `supabase/email-templates/*` - szablony maili auth.

## Model produktu

### Sesja nauki

1. Użytkownik startuje sesję z puli słów due + nowych.
2. Odpowiedź aktualizuje poziom słowa i daty powtórki w lokalnym stanie.
3. Po zakończeniu sesji aktualizowane są lokalne daily stats.
4. Po zakończeniu sesji i po zmianach ustawień pełny snapshot gracza trafia do Supabase w trybie best-effort.

### Konto użytkownika

1. User loguje się mailem przez Supabase Auth.
2. Dla usera powstaje albo podpinany jest rekord `players`.
3. Frontend pobiera snapshot ustawień i progressu.
4. Użytkownik nie konfiguruje już żadnych dodatkowych backendów ani fallbacków.

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

## Model danych

### W repo

- `words.json` - wersjonowana treść edukacyjna.

### W Supabase

- `players` - tożsamość gracza,
- `player_settings` - aktywne poziomy i ignorowane słówka,
- `player_daily_stats` - statystyki per dzień,
- `player_word_progress` - stan SRS per słowo,
- `player_public_stats` - publiczny snapshot.

### Lokalnie

- `localStorage` - cache runtime używany podczas sesji i po odświeżeniu UI.

## Ograniczenia architektoniczne

- Auth wymaga HTTP, więc `file://` nie jest wspieranym środowiskiem testowym.
- Frontend liczy część danych po stronie klienta, więc ranking opiera się na zaufaniu.
- Zapis do backendu musi być best-effort: użytkownik ma móc dokończyć sesję nawet przy chwilowym błędzie sieci.

## Kryteria sukcesu projektu

- user loguje się tylko przez Supabase,
- główny flow nie zawiera migracyjnych ani awaryjnych ścieżek auth,
- nowe urządzenie odzyskuje stan z prywatnego snapshotu Supabase,
- po zakończonej sesji aktualizują się zarówno daily stats, jak i progress słówek,
- publiczne porównania działają bez ujawniania surowych danych innych użytkowników.

## Poza zakresem na dziś

- wieloosobowy leaderboard z silnym anti-cheat,
- pełna offline-first kolejka synchronizacji z rozwiązywaniem konfliktów serwerowych,
- wiele niezależnych profili lokalnych na jednym urządzeniu,
- rozbudowane funkcje społecznościowe wykraczające poza porównanie statystyk.
