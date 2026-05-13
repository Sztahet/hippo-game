# Plan wygaszenia Google Sheets i ograniczenia roli localStorage

Ten dokument opisuje przejście do modelu, w którym Supabase jest jedynym backendem synchronizacji i odzyskiwania stanu. `localStorage` ma zostać zredukowany do lokalnego cache'u i bufora offline, a Google Sheets ma zostać usunięty z codziennego flow użytkownika.

## Cel końcowy

- Supabase jest źródłem prawdy dla auth, ustawień, daily stats i progressu słówek.
- `localStorage` służy tylko do szybkiego renderu, krótkiego bufora offline i recovery po refreshu.
- Google Sheets jest wyłączony z runtime i zostaje najwyżej narzędziem jednorazowego importu historycznych danych.
- Publiczne porównania czytają tylko z `player_public_stats`.

## Stan bieżący

- Supabase schema i migracje są już przygotowane.
- Auth przez magic link działa.
- Istnieje bootstrap gracza i jednorazowy import legacy danych.
- Frontend potrafi pobrać prywatny snapshot z Supabase po zalogowaniu.
- Bieżący runtime używa Supabase głównie do auth, odczytu snapshotu i jednorazowego importu legacy danych.
- Google Sheets nadal może wpływać na lokalny stan użytkownika w okresie przejściowym.
- `localStorage` nadal jest aktywnie używany przez runtime jako lokalny stan roboczy.

## Zasady przejścia

1. Nie blokujemy nauki, jeśli backend chwilowo nie odpowiada.
2. Nie rozwijamy już Google Sheets jako docelowego backendu.
3. Nie rozbudowujemy nowych feature'ów na starym modelu storage.
4. Każda nowa ścieżka syncu musi mieć czytelny owner: Supabase albo legacy recovery.
5. Publiczny ranking nigdy nie czyta z surowych tabel innych niż przygotowany snapshot.

## Faza 0 - Fundamenty Supabase

Status: zrobione.

Zakres:

1. Schema tabel i RLS.
2. Auth bootstrap gracza.
3. Legacy import z payloadu przeglądarkowego.
4. Prywatny snapshot do hydratacji stanu.

Exit criteria:

- można utworzyć użytkownika przez Auth,
- można zaimportować stare dane,
- można odtworzyć stan z Supabase na nowym urządzeniu.

## Faza 1 - Stabilizacja live write path

Status: w toku.

Zakres:

1. Zapis do Supabase po zakończeniu sesji.
2. Zapis do Supabase po zmianie ustawień profilu i filtrów.
3. Retry, jeśli Supabase ma mniej danych niż aktualny lokalny stan.
4. Widoczny status sukcesu albo błędu zapisu dla użytkownika.

Exit criteria:

- nowa sesja zwiększa wpisy w `player_daily_stats`,
- zmiany SRS aktualizują `player_word_progress`,
- użytkownik widzi, czy zapis do Supabase się udał.

## Faza 2 - Supabase jako primary read path

Zakres:

1. Po zalogowaniu Supabase snapshot jest traktowany jako główny stan wejściowy.
2. `localStorage` jest tylko cachem lokalnym, nie konkurencyjnym źródłem prawdy.
3. Konflikty lokalne vs zdalne mają jawne reguły merge'u.

Reguły merge'u na start:

- `player_settings`: ostatni zapis wygrywa,
- `player_daily_stats`: merge po `stat_date`,
- `player_word_progress`: wygrywa nowsze `last_review`, a przy remisie wyższy `level`.

Exit criteria:

- nowy user po zalogowaniu odzyskuje swój stan bez Google Sheets,
- refresh aplikacji nie wymaga ręcznej korekty lokalnych danych.

## Faza 3 - Degradacja Google Sheets do recovery only

Zakres:

1. Ukrycie ustawień Google Sheets dla nowych użytkowników.
2. Pozostawienie tylko ręcznego importu legacy dla starych urządzeń.
3. Brak nowych write pathów do Apps Script.

Exit criteria:

- nowi użytkownicy nie konfigurują już Sheets,
- Google Sheets nie jest potrzebny do codziennego użycia.

## Faza 4 - Ograniczenie localStorage do cache'u

Zakres:

1. Zapis lokalny nadal pozostaje szybkim cachem UI.
2. Recovery po restarcie aplikacji opiera się przede wszystkim na Supabase.
3. Brak logiki biznesowej, która zakłada, że `localStorage` to jedyne trwałe źródło prawdy.

Exit criteria:

- czyszczenie localStorage nie powoduje utraty konta ani stanu po ponownym zalogowaniu,
- aplikacja odtwarza komplet danych z Supabase.

## Faza 5 - Usunięcie legacy elementów

Zakres:

1. Usunięcie UI i kodu Google Sheets z głównego flow.
2. Usunięcie lokalnego fallbacku hasłowego, jeśli nie jest już potrzebny.
3. Uproszczenie kodu startowego i ekranu ustawień.

Exit criteria:

- jedna ścieżka auth,
- jedna ścieżka synchronizacji,
- jedna dokumentowana strategia recovery.

## Co jest jeszcze do domknięcia

- jawny status zapisu do Supabase po sesji,
- dedykowane RPC lub API do write pathów zamiast przeciążania bootstrapu,
- test end-to-end: stary user z Google Sheets -> login -> pełna migracja -> nowe urządzenie bez Sheets,
- finalne ukrycie legacy UI dla użytkowników, którzy nie potrzebują recovery.

## Ryzyka

### Cheating

Frontend nadal liczy dane po stronie klienta, więc ranking opiera się na zaufaniu. To jest akceptowalne dla prywatnych porównań, ale nie dla otwartego leaderboardu z wysoką stawką.

### Offline i transient failures

Backend nie może blokować sesji nauki. Każdy zapis zdalny musi być best-effort, a lokalny cache musi pozwalać dokończyć sesję.

### Legacy drift

Im dłużej zostawiamy Google Sheets jako pełnoprawny sync, tym dłużej utrzymujemy dwa modele stanu. To zwiększa ryzyko rozjazdów i błędów migracyjnych.

## Minimalne Definition of Done dla cutoveru

- user loguje się tylko przez Supabase,
- po sesji dane trafiają do `player_daily_stats` i `player_word_progress`,
- nowe urządzenie odzyskuje stan bez Google Sheets,
- `localStorage` może zostać wyczyszczony bez trwałej utraty postępu,
- Google Sheets nie jest potrzebny do normalnego użytkowania.