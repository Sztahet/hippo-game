# Co dalej — roadmap po cutoverze

## Priorytet P0: ustabilizować nowy write path

1. **Spójna strategia konfliktów i retry**
   - Udokumentować merge dla `player_settings`, `player_daily_stats` i `player_word_progress`.
   - Upewnić się, że retry nie nadpisuje nowszego stanu starszym snapshotem.

2. **Test end-to-end: login -> sesja -> nowe urządzenie**
   - Zalogować nowego usera.
   - Rozegrać sesję.
   - Zweryfikować zapis do Supabase.
   - Odtworzyć ten sam stan na drugim urządzeniu.

## Priorytet P1: obserwowalność i jakość techniczna

3. **Lepsze logowanie błędów synchronizacji**
   - Rozróżnić błąd auth, błąd RPC, błąd sieci i konflikt danych.
   - Mieć prosty sposób na diagnozę bez ręcznego grzebania w DevTools.

4. **Checklist deploymentu**
   - Spisać krótki release checklist: migracje SQL, redirect URLs, smoke test loginu, smoke test zapisu po sesji.

5. **Testy dla logiki zapisu**
   - Pokryć serializację payloadów testami.
   - Osobno przetestować daily stats, word progress i settings.

## Priorytet P2: rozwój produktu

6. **Publiczne porównania i leaderboard**
   - Zbudować UI czytające tylko z `player_public_stats`.
   - Dodać filtrowanie i podstawowe profile publiczne.

7. **Eksport kopii zapasowej**
   - Traktować to jako narzędzie recovery, nie podstawowy sync.

8. **Rozwój UX nauki**
    - EN → PL,
    - audio/TTS,
    - dodatkowe filtry i kategorie słówek,
    - bardziej czytelne statystyki postępu.

## Definition of Done dla najbliższego etapu

- pełna sesja aktualizuje Supabase bez ręcznej interwencji,
- odświeżenie i nowe urządzenie odzyskują stan z Supabase,
- użytkownik widzi status ostatniego zapisu,
- `localStorage` może zostać odtworzony z backendu.
