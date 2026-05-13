# Supabase backend

Ten katalog opisuje docelowy backend projektu. Supabase nie jest już tylko scaffoldingiem pod publiczne statystyki. To warstwa, do której projekt ma docelowo przenieść auth, synchronizację ustawień, dzienne statystyki, progress słówek i publiczne porównania. `localStorage` oraz Google Sheets pozostają tylko warstwami przejściowymi i recovery.

## Zakres odpowiedzialności Supabase

- logowanie magic linkiem,
- identyfikacja gracza,
- synchronizacja ustawień profilu,
- zapis `player_daily_stats`,
- zapis `player_word_progress`,
- publiczny snapshot `player_public_stats`.

## Zawartość katalogu

- `migrations/202605110001_init_public_stats.sql` - schema tabel, RLS, triggery i publiczny snapshot.
- `migrations/202605120001_auth_bootstrap_and_legacy_import.sql` - bootstrap gracza po auth oraz jednorazowy import legacy danych.
- `migrations/202605130001_get_my_player_snapshot.sql` - prywatny snapshot do odtworzenia stanu aplikacji po zalogowaniu.
- `generate_import_sql.js` - ręczny generator SQL do recovery i importu z `localStorage`.
- `migration-plan.md` - plan wygaszenia Google Sheets i uproszczenia storage modelu.

## Model danych

- `public.players` - rekord gracza powiązany z `auth.users`.
- `public.player_settings` - aktywne poziomy CEFR i ignorowane słówka.
- `public.player_daily_stats` - dzienne agregaty sesji.
- `public.player_word_progress` - stan SRS per słowo.
- `public.player_public_stats` - bezpieczny publiczny snapshot do rankingu.

RLS jest włączony na surowych tabelach. Publicznie czytelny ma zostać tylko `player_public_stats` dla rekordów z `is_public = true`.

## Deployment projektu Supabase

1. Załóż projekt w Supabase.
2. Otwórz SQL Editor.
3. Uruchom migracje w tej kolejności:
   - `202605110001_init_public_stats.sql`
   - `202605120001_auth_bootstrap_and_legacy_import.sql`
   - `202605130001_get_my_player_snapshot.sql`
4. W `Authentication -> URL Configuration` ustaw `Site URL` i `Redirect URLs` dla:
   - `http://localhost:8080`
   - `http://localhost:3000`
   - produkcyjnego URL z GitHub Pages
5. Włącz email magic link jako główny sposób logowania.
6. Wpisz `url` i `publishableKey` do `supabase-config.js`.

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
- upsertuje `player_settings`, `player_daily_stats` i `player_word_progress`,
- odświeża `player_public_stats`,
- jest obecnie używana głównie do bootstrapu konta i jednorazowego importu legacy danych z przeglądarki.

### `get_my_player_snapshot()`

Ta funkcja zwraca prywatny snapshot zalogowanego gracza:

- `settings`,
- `dailyStats`,
- `wordProgress`.

Frontend używa jej przy starcie do hydratacji lokalnego stanu i do porównania, czy legacy marker importu nadal ma sens.

## Aktualny flow frontendu

1. User loguje się magic linkiem.
2. Frontend odzyskuje sesję Supabase.
3. Jeśli istnieją legacy dane lokalne, frontend może je przepchnąć do `bootstrap_player_from_auth`.
4. Frontend pobiera `get_my_player_snapshot()` i odbudowuje lokalny stan gry.
5. Jeśli Google Sheets jest jeszcze skonfigurowany, może nadal zasilać lokalny stan w okresie przejściowym.
6. Bieżąca wersja runtime nie traktuje jeszcze Supabase jako stałego write pathu po każdej sesji; to jest nadal etap przejściowy.

## Ręczny recovery i import

Jeśli trzeba odratować stare dane z urządzenia, wyeksportuj z przeglądarki:

```js
copy(JSON.stringify({
  vocab_progress: JSON.parse(localStorage.getItem('vocab_progress') || '{}'),
  vocab_daily_stats: JSON.parse(localStorage.getItem('vocab_daily_stats') || '{}'),
  vocab_active_levels: JSON.parse(localStorage.getItem('vocab_active_levels') || '[]'),
  vocab_ignored_word_ids: JSON.parse(localStorage.getItem('vocab_ignored_word_ids') || '[]')
}, null, 2));
```

Potem wygeneruj SQL:

```powershell
node supabase/generate_import_sql.js --input stats-export.json --handle ania --display-name "Ania" > supabase/manual-import.sql
```

Opcjonalnie profil prywatny od startu:

```powershell
node supabase/generate_import_sql.js --input stats-export.json --handle ania --display-name "Ania" --private > supabase/manual-import.sql
```

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

## Kierunek docelowy

- Supabase ma zostać jedynym backendem synchronizacji i recovery.
- Google Sheets ma zostać zdegradowany do jednorazowego importu albo całkowicie usunięty.
- `localStorage` ma służyć do szybkiego renderu i offline bufferu, nie jako trwałe źródło prawdy.

Szczegółowy plan tego przejścia jest w `supabase/migration-plan.md`.