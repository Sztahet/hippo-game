# Supabase backend

Ten katalog opisuje aktywny backend projektu. Supabase obsługuje logowanie, bootstrap rekordu gracza, prywatny snapshot stanu i publiczny snapshot statystyk. Frontend nie używa już migracyjnych ścieżek z poziomu UI.

## Zakres odpowiedzialności Supabase

- logowanie mailowe (`Confirm signup`, `Magic Link` i opcjonalnie e-mail + hasło po zapisaniu hasła przez użytkownika),
- identyfikacja gracza i powiązanie z `auth.users`,
- prywatny snapshot ustawień i postępu,
- publiczny snapshot `player_public_stats`,
- write path dla `player_settings`, `player_daily_stats` i `player_word_progress`.

## Zawartość katalogu

- `current-schema.sql` - kanoniczny snapshot aktualnej wersji schematu, funkcji, triggerów, RLS i grantów; tego pliku używaj do stawiania pustego projektu i szybkiego audytu backendu.
- `migrations/` - historia ewolucji backendu i inkrementalne zmiany dla już istniejących środowisk.
- `email-templates/` - szablony maili `Confirm signup` i `Magic Link`.
- `migration-plan.md` - krótka notatka o zamknięciu cutoveru i kolejnych krokach.

## Model danych

- `public.players` - rekord gracza powiązany z `auth.users`.
- `public.player_settings` - aktywne poziomy CEFR i ignorowane słówka.
- `public.player_daily_stats` - dzienne agregaty sesji.
- `public.player_word_progress` - stan SRS per słowo.
- `public.player_public_stats` - bezpieczny publiczny snapshot do rankingu.

RLS jest włączony na surowych tabelach. Publicznie czytelny ma pozostać tylko `player_public_stats` dla rekordów z `is_public = true`.

## Deployment projektu Supabase

1. Załóż projekt w Supabase.
2. Otwórz SQL Editor.
3. Dla pustego projektu uruchom `current-schema.sql`.
4. Jeśli aktualizujesz już istniejące środowisko, dokładaj tylko nowe migracje z `migrations/` zamiast odpalać cały łańcuch od początku.
5. W `Authentication -> URL Configuration` ustaw `Site URL` i `Redirect URLs` dla:
   - `http://localhost:8080`
   - `http://localhost:3000`
   - produkcyjnego URL z GitHub Pages
6. W `Authentication -> Email Templates` ustaw własne szablony dla:
   - `Confirm signup`: `Subject` z `email-templates/confirmation-subject.txt`, `Content` z `email-templates/confirmation.html`
   - `Magic Link`: `Subject` z `email-templates/magic-link-subject.txt`, `Content` z `email-templates/magic-link.html`
7. W obu szablonach zostaw placeholder `{{ .ConfirmationURL }}` w głównym przycisku.
8. `signInWithOtp()` tworzy użytkownika, jeśli adres jeszcze nie istnieje, więc pierwszy mail dla nowego adresu będzie typu `Confirm signup`, a kolejne logowania pójdą już standardowym `Magic Link`.
9. Po zalogowaniu użytkownik może w UI wywołać `auth.updateUser({ password })` i od tej chwili korzystać też z `signInWithPassword(...)` bez wysyłania kolejnych maili.
10. Jeśli używasz własnego SMTP, wyłącz email tracking po stronie dostawcy, żeby nie przepisywał linków auth.
11. Wpisz `url` i `publishableKey` do `supabase-config.js`.

## Workflow zmian SQL

1. Dodaj nową migrację do `migrations/`, jeśli zmiana ma trafić na istniejące środowiska.
2. Po ustaleniu finalnej definicji obiektu przepisz ją też do `current-schema.sql`.
3. Traktuj `current-schema.sql` jako punkt prawdy dla aktualnego backendu, a `migrations/` jako dziennik dojscia do tego stanu.

Szybka kontrola po wdrożeniu:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'player_%'
order by table_name;
```

## Frontend config

Frontend potrzebuje tylko dwóch publicznych wartości:

```js
window.HIPPO_SUPABASE_CONFIG = {
  url: 'https://twoj-projekt.supabase.co',
  publishableKey: 'sb_publishable_xxx'
};
```

Nie używamy service role key w przeglądarce.

## Kontrakt runtime

### `bootstrap_player_from_auth(import_payload jsonb)`

Ta funkcja:

- tworzy albo podpina rekord `players` do zalogowanego usera,
- potrafi upsertować `player_settings`, `player_daily_stats` i `player_word_progress`,
- odświeża `player_public_stats`,
- jest obecnie wywoływana przez frontend z pustym payloadem tylko po to, żeby zapewnić rekord gracza po logowaniu.

### `get_my_player_snapshot()`

Ta funkcja zwraca prywatny snapshot zalogowanego gracza:

- `settings`,
- `dailyStats`,
- `wordProgress`.

Frontend używa jej przy starcie do hydratacji lokalnego stanu po zalogowaniu.

### `sync_player_state_from_auth(state_payload jsonb)`

Ta funkcja:

- zapewnia rekord `players` dla zalogowanego usera,
- zapisuje pełny snapshot `player_settings`, `player_daily_stats` i `player_word_progress`,
- akceptuje payloady w `camelCase` i `snake_case`,
- robi tylko upserty i nie usuwa istniejących wierszy po stronie backendu,
- odświeża `player_public_stats` po każdym zapisie.

## Aktualny flow frontendu

1. User loguje się mailem przez `Magic Link` albo, jeśli wcześniej ustawił hasło, przez e-mail + hasło.
2. Frontend odzyskuje albo odświeża sesję Supabase.
3. Frontend wywołuje `bootstrap_player_from_auth({})`, żeby zapewnić rekord `players`.
4. Frontend pobiera `get_my_player_snapshot()` i odbudowuje lokalny stan gry.
5. Zalogowany user może opcjonalnie ustawić albo zmienić hasło przez `auth.updateUser({ password })`.
6. Po zakończonej sesji i po zmianach ustawień frontend wywołuje `sync_player_state_from_auth(...)` z pełnym snapshotem klienta.

## Przydatne zapytania operacyjne

Snapshot publiczny:

```sql
select *
from public.player_public_stats
where is_public = true
order by current_streak desc, mastered_words desc, total_sessions desc, updated_at desc;
```

Stan jednego gracza:

```sql
select
  p.handle,
  p.display_name,
  count(distinct ds.stat_date) as daily_rows,
  count(distinct wp.word_id) as word_rows
from public.players as p
left join public.player_daily_stats as ds on ds.player_id = p.id
left join public.player_word_progress as wp on wp.player_id = p.id
where p.handle = 'ania'
group by p.handle, p.display_name;
```

Dzienne staty jednej osoby:

```sql
select ds.*
from public.player_daily_stats as ds
join public.players as p on p.id = ds.player_id
where p.handle = 'ania'
order by ds.stat_date desc;
```

Progress słówek jednej osoby:

```sql
select wp.*
from public.player_word_progress as wp
join public.players as p on p.id = wp.player_id
where p.handle = 'ania'
order by wp.word_id asc
limit 100;
```

## Aktualny stan techniczny

- Supabase jest jedyną aktywną ścieżką auth.
- UI i runtime nie używają już starych ścieżek migracyjnych.
- `localStorage` pozostaje cachem runtime, ale po zakończonej sesji i zmianach ustawień jest synchronizowany do Supabase.
- Szczegóły najbliższych prac są w `supabase/migration-plan.md`.