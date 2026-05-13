# Co dalej — roadmap pod Supabase-only

## Priorytet P0: domknąć storage cutover

1. **Jawny status zapisu do Supabase po sesji**
   - Pokazać na podsumowaniu albo home, czy `player_daily_stats` i `player_word_progress` zostały zapisane.
   - Dodać komunikat błędu i możliwość ponowienia zapisu.

2. **Dedykowany write path dla danych runtime**
   - Rozdzielić bootstrap/import od bieżącego zapisu.
   - Zamiast przeciążać `bootstrap_player_from_auth`, dodać osobny RPC albo zestaw upsertów dla daily stats, settings i word progress.

3. **Test end-to-end: legacy user -> Supabase-only**
   - Urządzenie ze starym stanem na Sheets/localStorage.
   - Login magic linkiem.
   - Import do Supabase.
   - Nowe urządzenie odzyskuje pełny stan bez Google Sheets.

4. **Spójna strategia konfliktów**
   - Udokumentować i egzekwować merge dla `player_settings`, `player_daily_stats` i `player_word_progress`.
   - Upewnić się, że retry nie nadpisuje nowszego stanu starszym snapshotem.

## Priorytet P1: ograniczyć legacy warstwy

5. **Ukryć Google Sheets dla nowych użytkowników**
   - Zostawić tylko opcję recovery/importu dla starych urządzeń.
   - Nie zachęcać już do konfiguracji Apps Script jako normalnego flow.

6. **Ograniczyć localStorage do cache'u**
   - Po zalogowaniu traktować Supabase jako główny stan wejściowy.
   - Czyścić stare markery i uprościć lokalne klucze, które nie są już potrzebne jako trwałe źródło prawdy.

7. **Usunąć legacy password fallback**
   - Jeśli produkcja działa już na Supabase Auth, usunąć lokalne hasło aplikacyjne i związane z nim ścieżki UI.

## Priorytet P2: observability i bezpieczeństwo operacyjne

8. **Lepsze logowanie błędów synchronizacji**
   - Rozróżnić błąd auth, błąd RPC, błąd sieci i konflikt danych.
   - Mieć prosty sposób na diagnozę bez ręcznego grzebania w DevTools.

9. **Checklist deploymentu**
   - Spisać krótki release checklist: migracje SQL, redirect URLs, smoke test loginu, smoke test zapisu po sesji.

10. **Testy dla logiki syncu**
    - Pokryć merge i serializację payloadów testami.
    - Osobno przetestować daily stats, word progress i settings.

## Priorytet P3: rozwój produktu po cutoverze

11. **Publiczne porównania i leaderboard**
    - Zbudować UI czytające tylko z `player_public_stats`.
    - Dodać filtrowanie i podstawowe profile publiczne.

12. **Eksport/import kopii zapasowej**
    - Traktować to jako narzędzie recovery, nie podstawowy sync.

13. **Rozwój UX nauki**
    - EN → PL,
    - audio/TTS,
    - dodatkowe filtry i kategorie słówek,
    - bardziej czytelne statystyki postępu.

## Definition of Done dla najbliższego etapu

- pełna sesja aktualizuje Supabase bez ręcznej interwencji,
- nowe urządzenie odzyskuje stan z Supabase,
- Google Sheets nie jest potrzebny nowemu użytkownikowi,
- `localStorage` nie jest już traktowany jak jedyne trwałe źródło postępu.
