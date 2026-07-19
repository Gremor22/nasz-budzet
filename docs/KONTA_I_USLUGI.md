# Konta i usługi — instrukcja dla osoby nietechnicznej

Te konta **nie są potrzebne od razu**.  
Etap 1 (prototyp) działa na komputerze bez Supabase i Vercel.

---

## 1. GitHub (kod aplikacji)

**Po co:** miejsce na kod i historię wersji.

**Kiedy:** najlepiej przed końcem Etapu 1 lub na początku Etapu 2.

**Jak:**

1. Wejdź na [https://github.com](https://github.com)
2. Utwórz konto (e-mail + hasło)
3. Potwierdź e-mail
4. Później utworzymy repozytorium „BudgetPlanner” i połączymy je z folderem na komputerze (ja podam dokładne komendy)

**Koszt:** bezpłatnie na start.

---

## 2. Supabase (baza, logowanie, zdjęcia)

**Po co:** przechowywanie danych Pawła i Mileny, logowanie, zdjęcia paragonów.

**Kiedy:** Etap 2.

**Jak (ogólnie):**

1. Wejdź na [https://supabase.com](https://supabase.com)
2. Zaloguj się (można przez GitHub)
3. Utwórz projekt (wybierz region blisko Polski, np. Frankfurt, jeśli dostępny)
4. Zapisz hasło bazy w bezpiecznym miejscu (menedżer haseł)
5. W ustawieniach projektu skopiujesz dwa klucze do pliku `.env.local` (ja wskażę dokładnie które)

**Koszt:** plan Free zwykle wystarczy dla 2 osób na start.

**Uwaga:** klucza „service role” **nigdy** nie wklejamy do publicznego kodu ani na czat bez potrzeby.

---

## 3. Vercel (publikacja w internecie)

**Po co:** żeby otwierać aplikację na iPhonie spod adresu HTTPS (wymagane do PWA).

**Kiedy:** Etap 7 (po działającej wersji lokalnej).

**Jak (ogólnie):**

1. Wejdź na [https://vercel.com](https://vercel.com)
2. Zaloguj się przez GitHub
3. „Import” repozytorium BudgetPlanner
4. Dodaj te same zmienne środowiskowe co lokalnie
5. Deploy (wdrożenie)

**Koszt:** plan Hobby bezpłatny na start.

---

## 4. Dwa adresy e-mail do testów

**Po co:** osobne konta Pawła i Mileny.

Możesz użyć:

- dwóch prawdziwych skrzynek, albo
- aliasów (np. `twoj+pawel@gmail.com` i `twoj+milena@gmail.com`), jeśli dostawca to obsługuje.

---

## Checklista kont

- [ ] GitHub
- [ ] Supabase (Etap 2)
- [ ] Vercel (Etap 7)
- [ ] 2 e-maile testowe
- [ ] (Opcjonalnie) dostawca OCR — decyzja w Etapie 5
