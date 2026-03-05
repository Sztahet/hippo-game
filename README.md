# 🦛 Hippo Words — Nauka Słówek PL→EN

Aplikacja do nauki angielskich słówek metodą spaced repetition (SRS), z synchronizacją postępu przez Google Sheets.

**Live:** https://sztahet.github.io/hippo-game/

---

## Funkcje

- **Spaced repetition** — 9 poziomów (0 → 730 dni), algorytm SM-2-inspired
- **~10 000 słów** w 6 poziomach trudności CEFR: A1, A2, B1, B2, C1, C2
- **Synchronizacja postępu** przez Google Sheets — działa na wielu urządzeniach
- **Zabezpieczenie hasłem** — dostęp tylko dla uprawnionej osoby
- **Mobile-friendly** — działa na telefonie i tablecie

---

## Architektura

```
hippo-game/
├── index.html          # Strona główna (wymaga serwera HTTP)
├── app.js              # Cała logika aplikacji (vanilla JS)
├── style.css           # Style (mobile-first)
├── words.json          # Baza słówek (~10 000 par PL→EN z poziomami CEFR)
├── build.js            # (Opcjonalnie) skrypt budujący bundle offline
├── words_20k_pipeline.js # Czyszczenie i import slow z 20k.txt
├── generate_words.py   # Pierwotny skrypt generujący słówka A1 (Python)
├── generate_words_v2.js # Skrypt generujący pełną bazę A1-C2 (Node.js)
└── google-apps-script.js # Backend Google Apps Script (synchronizacja)
```

---

## Poziomy CEFR

| Poziom | Opis | Przykłady słów |
|--------|------|----------------|
| **A1** | Podstawy — pierwsze słowa | dom, kot, jeść, być |
| **A2** | Elementarny — codzienne sytuacje | zakupy, transport, zdrowie |
| **B1** | Średniozaawansowany — praca, podróże | kariera, technologia, środowisko |
| **B2** | Wyższy średni — tematy abstrakcyjne | polityka, nauka, biznes |
| **C1** | Zaawansowany — profesjonalny | akademicki, prawniczy, medyczny |
| **C2** | Biegły — rzadkie i literackie | archaikizmy, specjalistyczne |

Poziomy włączane/wyłączane w **Ustawieniach** aplikacji.

---

## Algorytm spaced repetition

| Poziom nauki | Następna powtórka |
|---|---|
| 0 (reset/nowe) | następna sesja |
| 1 | 1 dzień |
| 2 | 3 dni |
| 3 | 7 dni |
| 4 | 14 dni |
| 5 | 30 dni |
| 6 | 90 dni |
| 7 | 180 dni |
| 8 (opanowane) | 2 lata |

- **Poprawna odpowiedź** → +1 poziom  
- **Literówka** (1 znak błędu) → −1 poziom  
- **Błędna odpowiedź** → reset do poziomu 0  

---

## Synchronizacja z Google Sheets

Postęp nauki synchronizowany jest z Google Sheets przez Google Apps Script. Działa na wielu urządzeniach jednocześnie (np. telefon + laptop).

### Konfiguracja

1. Utwórz nowy arkusz Google Sheets
2. Nazwij pierwszą zakładkę: **Progress**
3. W wierszu 1 wpisz nagłówki: `wordId` | `level` | `nextReview` | `lastReview`
4. Otwórz **Rozszerzenia → Apps Script**
5. Wklej zawartość pliku `google-apps-script.js`
6. **Zmień `SECRET_TOKEN`** na własne, unikalne hasło
7. Kliknij **Wdróż → Nowe wdrożenie**
   - Typ: *Aplikacja internetowa*
   - Wykonaj jako: *Ja*
   - Kto ma dostęp: *Każdy*
8. Skopiuj URL wdrożenia
9. W aplikacji wejdź w **Ustawienia** i wklej URL oraz token

> ⚠️ Po każdej zmianie kodu Apps Script musisz tworzyć **nowe** wdrożenie (nie edytować istniejące).

---

## Hasło dostępu

Aby zmienić hasło, edytuj w `app.js`:

```js
const ACCESS_PASSWORD = 'hippo123';
```

Nastepnie zrob commit i push:

```powershell
git add .
git commit -m "zmiana hasla"
git push
```

GitHub Pages zaktualizuje się automatycznie po ~1 minucie.

---

## Entwicklung lokalny

```powershell
# Uruchom serwer lokalny (Node.js)
npx serve .
# → http://localhost:3000

# Lub (Python)
python3 -m http.server 8080
# → http://localhost:8080
```

## Budowanie bundle (opcjonalnie, offline)

```powershell
node build.js
# → bundle.html (samodzielny plik, działa bez serwera)
```

## Dodawanie słówek

Import i cleanup z listy `20k.txt`:

```powershell
# Sam cleanup (duplikaty, szum, PL==EN)
node words_20k_pipeline.js --clean-only --import-start-id=3327

# Cleanup + dodanie np. 3000 nowych slow
node words_20k_pipeline.js --target=3000 --import-start-id=3327

# Cleanup + zuzycie calej kolejki z gory
node words_20k_pipeline.js --consume-all --import-start-id=3327

git add .
git commit -m "cleanup i import slow"
git push
```

`bundle.html` nie jest potrzebny do GitHub Pages. Wystarcza `index.html` + `app.js` + `style.css` + `words.json`.

Import działa teraz jak kolejka FIFO: skrypt bierze wpisy od góry `20k.txt` i konsumuje je od góry.
Jeśli dany wpis nie zostanie dodany (np. filtr, duplikat, słaba jakość), i tak znika z początku kolejki.

Po wyczerpaniu kolejki możesz po prostu ponownie utworzyć `20k.txt` (1 angielskie słowo na linię)
i uruchomić pipeline tym samym skryptem.

---

## Technologie

- Vanilla JavaScript (ES2020+), bez frameworków
- CSS custom (mobile-first, bez bibliotek)
- Google Apps Script (backend sync)
- GitHub Pages (hosting)
