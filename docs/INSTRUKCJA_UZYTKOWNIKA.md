# Instrukcja użytkownika — Nasz Budżet

Przewodnik dla Pawła i Mileny. Wersja aplikacji: Etap 7.

Adres produkcyjny: **https://nasz-budzet.vercel.app**

---

## 1. Logowanie i gospodarstwo

1. Wejdź na stronę aplikacji i wybierz **Rejestracja** (pierwsza osoba) lub **Logowanie**.
2. Pierwsza osoba po rejestracji tworzy **gospodarstwo** (np. „Paweł i Milena”).
3. Druga osoba rejestruje się osobno, a na ekranie onboardingu wybiera **Dołącz kodem**.
4. Pierwsza osoba generuje kod w **Więcej → Zaproszenie do gospodarstwa** (ważny 7 dni).
5. Po dołączeniu oboje widzą **te same konta, transakcje i prognozę**.

---

## 2. Konfiguracja budżetu

Przed codziennym użytkowaniem uzupełnij (menu **Więcej**):

| Ekran | Co ustawić |
|-------|------------|
| **Konta** | Konto wspólne, osobiste, gotówka |
| **Źródła dochodu** | Pensje, cykle wypłat, kwoty typowe i bezpieczne |
| **Rachunki cykliczne** | Czynsz, Netflix, telefon itd. |
| **Cele oszczędnościowe** | Wakacje, poduszka finansowa |

**Bufor bezpieczeństwa** (Więcej): kwota odejmowana od „bezpiecznie do wydania”.  
**Horyzont pulpitu** (Więcej): 7, 14 lub 30 dni widoku na Pulpicie.

---

## 3. Pulpit i tryby prognozy

Na **Pulpicie** zmieniasz tryb prognozy:

| Tryb | Znaczenie |
|------|-----------|
| **Ostrożny** | Tylko potwierdzone wpływy |
| **Realistyczny** | Domyślny — oczekiwane wpływy w kwocie bezpiecznej |
| **Pełna prognoza** | Pełne typowe kwoty i wpływy prognozowane |

**Prognoza** (zakładka dolna) pokazuje szczegółową oś czasu: wpływy, rachunki, saldo dzień po dniu.

---

## 4. Dodawanie transakcji

- **+** (środek dolnej nawigacji) → wydatek lub przychód ręcznie.
- **Zeskanuj paragon** → zdjęcie z aparatu lub galerii.

### Paragony — ważne

1. Aplikacja odczytuje paragon **lokalnie** (darmowo), potem próbuje **AI (Gemini)**.
2. **Zawsze sprawdź** sklep, datę i sumę — wydatek zapisuje się dopiero po **Potwierdź i dodaj wydatek**.
3. Jeśli widzisz komunikat o limicie Gemini — wpisz sumę ręcznie lub użyj **Popraw odczyt sumy**.
4. Zaznacz **Zapamiętaj kategorię dla tego sklepu** — przy kolejnych wizytach kategoria będzie proponowana.

---

## 5. Analityka i transakcje

- **Transakcje** — lista wszystkich operacji.
- **Analityka** — wykresy i podsumowania wg kategorii i osób (okresy: tydzień, miesiąc itd.).

---

## 6. Cele oszczędnościowe

**Więcej → Cele oszczędnościowe**

- Dodaj cel (nazwa, kwota docelowa, zebrane).
- **Zarezerwowane** — zebrane środki zmniejszają „bezpiecznie do wydania”.
- Możesz edytować i usuwać cele.

---

## 7. Aplikacja na iPhone (PWA)

1. Otwórz **Safari** (nie Chrome).
2. Wejdź na https://nasz-budzet.vercel.app
3. **Udostępnij** (ikona ze strzałką) → **Dodaj do ekranu początkowego**.
4. Uruchamiaj z ikony **Nasz Budżet** — bez paska Safari.

Bez internetu pojawi się komunikat; do edycji danych potrzebne jest połączenie.

---

## 8. Eksport i backup

**Więcej → Eksport danych**

| Przycisk | Zawartość |
|----------|-----------|
| **Backup JSON** | Pełna kopia: konta, dochody, rachunki, transakcje, cele |
| **Transakcje CSV** | Lista transakcji do Excela (średnik, UTF-8) |

**Zalecenie:** raz w miesiącu pobierz backup JSON.  
Zdjęcia paragonów są w chmurze Supabase — nie wchodzą do pliku JSON.

---

## 9. Rozwiązywanie problemów

| Problem | Co zrobić |
|---------|-----------|
| Limit Gemini przy paragonie | Odczekaj 1–15 min lub wpisz sumę ręcznie |
| Zła suma z OCR | Użyj „Popraw odczyt sumy” lub wpisz ze zdjęcia |
| Druga osoba nie widzi danych | Sprawdź kod zaproszenia i to samo gospodarstwo |
| Nie instaluje się na iPhone | Użyj Safari, nie innej przeglądarki |
| Błąd logowania | Sprawdź e-mail i hasło; wyloguj i zaloguj ponownie |

W aplikacji: **Więcej → Instrukcja** (`/pomoc`).

---

## 10. Prywatność

- Dane są w Supabase (UE, region wybrany przy tworzeniu projektu).
- Dostęp mają tylko zalogowani członkowie Twojego gospodarstwa.
- Klucze API (Gemini) są tylko na serwerze Vercel — nie w telefonie.

---

*Nasz Budżet — wspólny budżet domowy Pawła i Mileny.*
