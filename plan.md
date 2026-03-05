# Plan: Polish-English Vocabulary Flashcard App

Prosta aplikacja w czystym HTML/CSS/JS bez bibliotek. Słownictwo (1000 par PL↔EN) przechowywane w `words.json` w repo, postęp użytkownika w `localStorage`. System powtórek oparty na poziomach (spaced repetition).

---

**Struktura plików**
- `index.html` — szkielet UI + podpięcie plików
- `app.js` — cała logika (bez klas, czyste funkcje)
- `style.css` — minimalistyczny wygląd
- `words.json` — 1000 wpisów `{ id, pl, en }`

---

**Kroki implementacji**

**Faza 1 — Dane**
1. Wygenerować `words.json` z 1000 parami PL→EN (poziom A1–B1 CEFR, typowe słownictwo: przedmioty, czasowniki, przymiotniki, jedzenie, podróże, praca)

**Faza 2 — Logika core (`app.js`)**

2. `loadWords()` — `fetch('words.json')`
3. `loadProgress()` / `saveProgress()` — czytanie/zapis `localStorage["vocab_progress"]`
4. `buildSession(words, progress)` — wybór 20 słówek: 70% *due* + 30% nowe *(patrz algorytm niżej)*
5. `levenshtein(a, b)` + `checkAnswer(input, expected)` — tolerancja 1 literówki (1 literówka - cofa o 1 poziom) - w innym przypadku zeruje!
6. `advanceLevel(wordId, correct, progress)` — aktualizacja poziomu i daty

**Faza 3 — UI**

7. Ekran **Home** — statystyki (ile do powtórzenia dziś, ile nowych), przycisk „Zacznij sesję"
8. Ekran **Flashcard** — pasek postępu (1/20), duże polskie słowo, pole input EN, submit na Enter
9. Ekran **Feedback** — zielony/żółty/czerwony flash, pokazuje poprawną odpowiedź przy błędzie, auto-przejście po 1.5s
10. Ekran **Summary** — wyniki sesji (poprawne/błędne), następna sesja za X dni

---

**Algorytm wyboru sesji**
```
due  = słówka gdzie nextReview ≤ dziś, sortowane od najstarszych
new  = słówka bez wpisu w progress, w kolejności z pliku
dueSlots = min(14, len(due))
newSlots = min(20 - dueSlots, len(new))
```

---

**Tabela poziomów (spaced repetition)**

| Poziom | Przerwa przed powtórką |
|--------|-------------------------|
| 0 | nowe, nigdy nie widziane |
| 1 | 1 dzień |
| 2 | 3 dni |
| 3 | 7 dni |
| 4 | 14 dni |
| 5 | 30 dni |
| 6 | 90 dni |
| 7 | 180 dni |
| 8 | opanowane (~2 lata) |

- **Poprawna** → poziom +1, nextReview = dziś + interwał nowego poziomu
- **Błędna** → poziom -1 (min 0), nextReview = jutro

---

**Dane w localStorage** (`"vocab_progress"`)
```json
{
  "1": { "level": 2, "nextReview": "2026-03-08", "lastReview": "2026-03-05" }
}
```
Słówka bez wpisu = nowe (poziom 0).

---

**Weryfikacja**
1. Otworzyć `index.html` bezpośrednio w przeglądarce (bez serwera) — powinno działać
2. Pierwsza sesja: 20 nowych słówek (brak *due*)
3. Po poprawnej odpowiedzi: sprawdzić w DevTools → `localStorage["vocab_progress"]` ma `level: 1`
4. Symulacja kolejnego dnia: ręcznie ustawić `nextReview` na wczoraj → słówka pojawiają się w *due*
5. Test Levenshteina: `"caT"` → poprawne; `"caat"` → poprawne (1 literówka); `"caaat"` → błędne
6. Po osiągnięciu poziomu 8: słówko nie pojawia się w sesji

---

**Poza zakresem**
- Backend / serwer (działa z `file://`)
- Wiele profili użytkowników
- Wymowa audio
- Eksport/import pliku JSON
- Kierunek EN→PL
