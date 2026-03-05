# Co dalej — plan rozwoju aplikacji

## Stan obecny

Aplikacja jest w pełni zaimplementowana zgodnie z pierwotnym planem:
- ✅ `words.json` — 1000 par PL→EN
- ✅ `app.js` — pełna logika (637 linii): sesje, spaced repetition, Levenshtein, UI (Home / Flashcard / Feedback / Summary)
- ✅ `style.css` — kompletny styl
- ✅ `index.html` — szkielet
- ✅ `google-apps-script.js` — backend do synchronizacji z Google Sheets (kod gotowy, wymaga wdrożenia)

---

## Priorytety (co zrobić najpierw)

### 🔴 Pilne — przed regularnym używaniem

1. **Wdrożyć Google Apps Script**
   - Otworzyć Google Sheets → Rozszerzenia → Apps Script → wkleić kod z `google-apps-script.js`
   - Zmienić `SECRET_TOKEN` na własne hasło
   - Zrobić nowe wdrożenie jako aplikacja internetowa
   - URL wdrożenia wpisać w ustawieniach aplikacji

2. **Przetestować aplikację** ręcznie w przeglądarce:
   - Uruchomić `python3 -m http.server` w katalogu projektu
   - Pierwsza sesja: 20 nowych słówek
   - Test tolerancji literówek (`"caT"`, `"caat"` → ok; `"caaat"` → błąd)
   - Sprawdzić `localStorage["vocab_progress"]` w DevTools
   - Symulacja kolejnego dnia: ręcznie zmienić `nextReview` na wczoraj

---

### 🟡 Średni priorytet — ulepszenia UX

3. **Tryb EN→PL** (odwrotny kierunek)
   - Przycisk przełącznika na ekranie Home
   - `buildSession()` zwraca słówka w odwrotnej kolejności
   - Osobny postęp dla każdego kierunku (klucz w localStorage: `"vocab_progress_enpl"`)

4. **Wymowa audio (Text-to-Speech)**
   - Użyć wbudowanego `SpeechSynthesis` API przeglądarki (brak zależności zewnętrznych)
   - Przycisk 🔊 na karcie flashcard
   - Automatyczne odtwarzanie po poprawnej odpowiedzi (opcja w ustawieniach)

5. **Tryb ciemny (dark mode)**
   - Detekcja `prefers-color-scheme: dark`
   - Opcjonalny przełącznik w ustawieniach

6. **Kategorie słówek**
   - Dodać pole `category` do `words.json` (np. `"jedzenie"`, `"podróże"`, `"praca"`)
   - Filtr kategorii na ekranie Home

---

### 🟢 Niski priorytet — dodatkowe funkcje

7. **PWA (Progressive Web App)**
   - Dodać `manifest.json` i Service Worker
   - Aplikacja instalowalna na telefonie, działa offline

8. **Eksport/import postępu**
   - Przyciski na ekranie ustawień: „Pobierz kopię (.json)" i „Wczytaj kopię"
   - Zabezpieczenie przed przypadkowym nadpisaniem

9. **Wykresy statystyk**
   - Wykres słupkowy rozkładu poziomów (można użyć `<canvas>` bez bibliotek)
   - Historia sesji: ile słówek dziennie przez ostatnie 30 dni

10. **Więcej słówek**
    - Rozszerzyć `words.json` do 2000+ par (poziomy B2–C1)
    - Użyć `generate_words.py` lub ręcznie dodać kolejne kategorie

11. **Wiele profili użytkowników**
    - Różne klucze w localStorage (`vocab_progress_jan`, `vocab_progress_ania`)
    - Prosty ekran wyboru profilu przy starcie

---

## Drobne poprawki techniczne

- **Dostępność (a11y)**: dodać atrybuty `aria-label` do przycisków, `role="status"` do komunikatów feedback
- **Obsługa błędu CORS**: przy `file://` `fetch('words.json')` może nie działać w Firefox — dodać komunikat z instrukcją uruchomienia serwera HTTP
- **Testy jednostkowe**: pokryć `levenshtein()`, `buildSession()`, `advanceLevel()` testami w Node.js (np. z `node --test`)
