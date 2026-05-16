# Status cutoveru

Historyczny cutover do modelu Supabase-only został zamknięty. Główny flow aplikacji działa już bez dodatkowych backendów, migracyjnych ekranów i lokalnego fallbacku hasłowego.

## Obecny model runtime

- logowanie odbywa się wyłącznie przez Supabase Auth,
- `bootstrap_player_from_auth({})` zapewnia rekord `players` po zalogowaniu,
- `get_my_player_snapshot()` odtwarza lokalny stan z backendu,
- `sync_player_state_from_auth(...)` zapisuje pełny snapshot po zakończonej sesji i po zmianach ustawień,
- `localStorage` pozostaje cachem runtime podczas aktywnej sesji,
- publiczne porównania powinny czytać tylko z `player_public_stats`.

## Co zostało do domknięcia

1. Reguły retry i konfliktów dla lokalnego cache'u versus backend.
2. Test end-to-end: login, sesja, zapis, odtworzenie stanu na nowym urządzeniu.

## Ryzyka, które nadal obowiązują

- Backend nie może blokować sesji nauki, więc zapis musi być best-effort.
- Frontend nadal liczy część danych po stronie klienta, więc ranking opiera się na zaufaniu.
- Mimo aktywnego write pathu `localStorage` pozostaje aktywną warstwą roboczą podczas sesji i przy retry.

## Definition of Done dla kolejnego etapu

- pełna sesja aktualizuje dane w Supabase,
- odświeżenie i nowe urządzenie odzyskują stan z backendu,
- użytkownik widzi wynik ostatniego zapisu,
- `localStorage` da się bezpiecznie odbudować z danych serwera.