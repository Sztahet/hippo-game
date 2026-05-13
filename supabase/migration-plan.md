# Plan migracji do Supabase bez psucia starego flow

Ten plan zaklada migracje etapowa. Stara wersja aplikacji ma dalej dzialac na `localStorage` i opcjonalnym Google Sheets, a nowa wersja ma dokladac Supabase warstwa po warstwie.

## Cele

- nie robic big-bang rewrite
- nie uzaleznic gry od stalego dostepu do backendu
- zachowac kompatybilnosc ze stara wersja i obecnymi danymi
- najpierw odpalic publiczne porownania, potem ewentualnie pelny sync

## Zasady kompatybilnosci

1. `localStorage` pozostaje zrodlem prawdy, dopoki write path do Supabase nie bedzie stabilny.
2. Odczyt z Supabase nigdy nie blokuje startu sesji ani zapisu lokalnego.
3. Jesli Supabase padnie, gra ma dalej dzialac lokalnie.
4. Google Sheets moze zostac jako legacy sync, dopoki nie bedziemy gotowi go wygasic.
5. Publiczny ranking czyta tylko `player_public_stats`, nigdy surowe tabele.

## Stan teraz

- gra trzyma progress i daily stats lokalnie w przegladarce
- opcjonalny sync idzie przez Google Sheets Apps Script
- Supabase ma osobny scaffold bazy i reczny import danych
- stara wersja frontendu nie zna Supabase i to jest OK

## Docelowy model

### Warstwa lokalna

- `vocab_progress`
- `vocab_daily_stats`
- `vocab_active_levels`
- `vocab_ignored_word_ids`

### Warstwa Supabase

- `players` - tozsamosc gracza
- `player_settings` - ustawienia profilu i filtrow
- `player_daily_stats` - dzienne agregaty sesji
- `player_word_progress` - opcjonalny sync SRS per slowko
- `player_public_stats` - publiczny snapshot pod ranking

## Etap 0 - Bootstrap i import reczny

Cel: postawic baze i wrzucic pierwszego gracza bez zmian w runtime aplikacji.

Zakres:

1. Utworzyc projekt w Supabase i wdrozyc migracje SQL.
2. Wyeksportowac obecne dane z `localStorage`.
3. Wygenerowac SQL importu przez `supabase/generate_import_sql.js`.
4. Wkleic import do SQL Editor.

Kryterium zakonczenia:

- w `player_public_stats` widac pierwszy rekord
- stara aplikacja dalej dziala bez zadnych zmian

## Etap 1 - Read-only ranking w nowym froncie

Cel: pokazac porownanie z innymi bez ruszania obecnego zapisu.

Zakres:

1. Dodac do frontendu klienta Supabase tylko do odczytu.
2. Trzymac `SUPABASE_URL` i `SUPABASE_ANON_KEY` w konfiguracji frontu.
3. Na home dociagac ranking z `player_public_stats`.
4. Gdy request sie nie uda, ukryc sekcje rankingu albo pokazac lagodny fallback.

Wazne:

- zero zapisu do Supabase na tym etapie
- zero zmiany w `recordDailySession()` i `advanceLevel()`
- stara wersja nadal nic nie wie o backendzie publicznym

Kryterium zakonczenia:

- nowa wersja pokazuje ranking
- brak regresji w sesjach nauki offline

## Etap 2 - Lokalny profil gracza

Cel: miec po stronie UI dane potrzebne do publicznego porownania.

Zakres:

1. Dodac w ustawieniach pola `handle`, `displayName`, `isPublic`.
2. Trzymac je lokalnie, np. w nowych kluczach `localStorage`.
3. Nie wymagac jeszcze logowania.

Po co ten etap:

- pozwala przygotowac UI i walidacje nicku
- nie wiaze jeszcze uzytkownika z Supabase Auth
- nie psuje starego flow, bo to tylko dodatkowe ustawienia

Kryterium zakonczenia:

- gracz moze ustawic nick i widocznosc profilu lokalnie
- aplikacja nadal dziala bez konta i bez internetu

## Etap 3 - Auth jako opcja, nie wymog

Cel: zaczac odrozniac graczy w Supabase bez blokowania starej gry.

Zakres:

1. Dodac Supabase Auth, najlepiej email magic link albo GitHub login.
2. Po zalogowaniu utworzyc albo podpiac rekord w `players`.
3. Jesli uzytkownik nie jest zalogowany, zostaje tryb lokalny.

Wazne:

- brak logowania nie moze blokowac nauki
- tylko funkcje public profile/sync powinny zalezec od auth

Kryterium zakonczenia:

- zalogowany gracz ma powiazany rekord `players`
- niezalogowany gracz nadal gra normalnie lokalnie

## Etap 4 - Write path dla statystyk dziennych

Cel: po kazdej sesji odswiezac publiczne staty bez ruszania jeszcze calego syncu slowek.

Zakres:

1. Po `recordDailySession()` wykonywac upsert do `player_daily_stats`.
2. Aktualizowac `player_settings` po zmianie aktywnych poziomow i ignorowanych slowek.
3. Zachowac lokalny zapis jako pierwszy krok, a Supabase jako drugi, best-effort.
4. Jesli zapis zdalny sie nie uda, pokazac nienachalny status i sprobowac pozniej.

Minimalny algorytm:

1. zapisz lokalnie
2. odswiez UI
3. jesli jest auth i konfiguracja Supabase, wyslij upsert w tle
4. przy bledzie nic nie kasuj lokalnie

Kryterium zakonczenia:

- publiczny ranking odswieza sie po nowej sesji
- brak utraty danych przy chwilowym braku internetu

## Etap 5 - Write path dla progressu slowek

Cel: opcjonalnie przeniesc do Supabase rowniez SRS per slowko.

Zakres:

1. Po `advanceLevel()` kolejkowac zmienione `word_id` do synchronizacji.
2. W tle robic batch upsert do `player_word_progress`.
3. Zostawic Google Sheets jako fallback przez okres przejsciowy.

To jest etap, ktory najlatwiej odlozyc. Do publicznych porownan nie jest wymagany od razu.

Kryterium zakonczenia:

- nowa wersja umie odbudowac stan SRS z Supabase
- Google Sheets nie jest juz potrzebny do codziennego uzycia

## Etap 6 - Odczyt z Supabase jako nowy sync

Cel: nowa wersja potrafi pobrac swoje dane z backendu na nowym urzadzeniu.

Zakres:

1. Po zalogowaniu pobierac `player_settings`, `player_daily_stats` i opcjonalnie `player_word_progress`.
2. Miec jawna strategie konfliktow: lokalne vs zdalne.
3. Na poczatku preferowac import jednokierunkowy albo reczne potwierdzenie merge'u.

Najbezpieczniejsza strategia konfliktow na start:

- `player_settings`: ostatni zapis wygrywa
- `player_daily_stats`: merge po `stat_date`
- `player_word_progress`: preferuj rekord z nowszym `last_review`, a przy remisie wyzszy `level`

Kryterium zakonczenia:

- user moze wejsc na nowe urzadzenie i odzyskac stan bez Sheets

## Etap 7 - Wygaszenie Google Sheets

Cel: usunac legacy sync dopiero wtedy, gdy nowy flow jest sprawdzony.

Warunki przed wygaszeniem:

1. read path z Supabase jest stabilny
2. write path dla daily stats jest stabilny
3. przynajmniej jedna udana migracja usera end-to-end
4. recovery na nowym urzadzeniu dziala

Dopiero wtedy:

- ukryc ustawienia Sheets dla nowych userow
- zostawic import legacy jeszcze przez jakis czas
- usunac Apps Script na koncu, nie na poczatku

## Mapowanie kodu aplikacji na etapy

- `recordDailySession()` - Etap 4
- `advanceLevel()` - Etap 5
- `renderHome()` - Etap 1
- ekran ustawien sync/profilu - Etap 2 i 3
- bootstrap po starcie aplikacji - Etap 6

## Ryzyka i decyzje

### 1. Cheating

Frontend dalej liczy staty po stronie klienta, wiec ranking jest oparty na zaufaniu. Dla porownywania sie ze znajomymi to zwykle wystarczy.

### 2. Duplicate handles

`players.handle` jest unikalne. UI musi miec walidacje i sensowny komunikat, gdy nick jest zajety.

### 3. Offline-first

Jesli backend stanie, gra ma dalej dzialac. To oznacza, ze lokalny zapis nie moze byc uzalezniony od odpowiedzi z Supabase.

### 4. Zakres pierwszej integracji

Najlepszy pierwszy release to Etap 1 + Etap 2. Daje publiczny odczyt i przygotowuje profil, ale jeszcze nie ryzykuje utraty danych przez write path.

## Rekomendowana kolejnosc wdrozenia

1. Etap 0 teraz
2. Etap 1 jako pierwszy release frontendu z Supabase
3. Etap 2 zaraz po nim
4. Etap 3 dopiero gdy bedziemy gotowi na prawdziwe profile
5. Etap 4 jako pierwszy zapis zdalny
6. Etap 5 i 6 po potwierdzeniu stabilnosci
7. Etap 7 na samym koncu

## Minimalne Definition of Done dla migracji kompatybilnej

- stara wersja nadal dziala lokalnie
- nowa wersja nie blokuje nauki, gdy Supabase nie odpowiada
- publiczny ranking czyta tylko dane z `player_public_stats`
- zadna awaria backendu nie kasuje lokalnych statystyk
- Google Sheets zostaje fallbackiem, dopoki nie zakonczymy etapu 6