# Supabase stats scaffold

Ten katalog doklada osobny backend danych pod publiczne statystyki. Nie zmienia obecnej aplikacji ani syncu przez Google Sheets.

## Co tu jest

- `migrations/202605110001_init_public_stats.sql` - schema pod graczy, dzienne staty, progress slowek i publiczny snapshot do rankingu.
- `generate_import_sql.js` - generator SQL do importu danych z obecnego `localStorage`.

Generator akceptuje zarowno juz sparsowane obiekty JSON, jak i surowe stringi JSON wyjete bezposrednio z `localStorage`.

## Model danych

- `public.players` - tozsamosc gracza, pozniej mozna podpiasc do `auth.users`.
- `public.player_settings` - aktywne poziomy CEFR i ignorowane slowka.
- `public.player_daily_stats` - dzienne agregaty z obecnego `dailyStats`.
- `public.player_word_progress` - stan SRS per slowko.
- `public.player_public_stats` - bezpieczny publiczny snapshot pod leaderboard i porownania.

Surowe tabele maja wlaczone RLS. Publicznie czytelna jest tylko tabela `player_public_stats` dla rekordow z `is_public = true`.

## Deployment bazy

Najprostsza droga:

1. Zaloz projekt w Supabase.
2. Otworz SQL Editor.
3. Wklej zawartosc `supabase/migrations/202605110001_init_public_stats.sql`.
4. Uruchom skrypt SQL.

Po wdrozeniu mozesz sprawdzic, czy schema weszla:

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name like 'player_%'
order by table_name;
```

## Export aktualnych danych z przegladarki

W DevTools Console na uruchomionej grze odpal:

```js
copy(JSON.stringify({
  vocab_progress: JSON.parse(localStorage.getItem('vocab_progress') || '{}'),
  vocab_daily_stats: JSON.parse(localStorage.getItem('vocab_daily_stats') || '{}'),
  vocab_active_levels: JSON.parse(localStorage.getItem('vocab_active_levels') || '[]'),
  vocab_ignored_word_ids: JSON.parse(localStorage.getItem('vocab_ignored_word_ids') || '[]')
}, null, 2));
```

Wklej wynik do pliku, na przyklad `stats-export.json`.

## Wygenerowanie SQL importu

Z katalogu repo:

```powershell
node supabase/generate_import_sql.js --input stats-export.json --handle ania --display-name "Ania" > supabase/manual-import.sql
```

Jesli profil ma byc prywatny od startu:

```powershell
node supabase/generate_import_sql.js --input stats-export.json --handle ania --display-name "Ania" --private > supabase/manual-import.sql
```

Potem:

1. Otworz `supabase/manual-import.sql`.
2. Wklej go do SQL Editor w Supabase.
3. Uruchom.

## Przydatne zapytania

Publiczny ranking:

```sql
select *
from public.player_public_stats
where is_public = true
order by current_streak desc, mastered_words desc, total_sessions desc, updated_at desc;
```

Surowe dzienne staty jednej osoby:

```sql
select d.*
from public.player_daily_stats as d
join public.players as p on p.id = d.player_id
where p.handle = 'ania'
order by d.stat_date desc;
```

## Co dalej

Kiedy bedziemy podpinali frontend, najczystszy flow jest taki:

1. Supabase Auth dla profilu gracza.
2. Upsert do `player_daily_stats` po zakonczeniu sesji.
3. Upsert do `player_word_progress` po zmianach w SRS.
4. Odczyt rankingu tylko z `player_public_stats`.

Pelny, etapowy plan migracji kompatybilnej ze stara wersja jest opisany w `supabase/migration-plan.md`.