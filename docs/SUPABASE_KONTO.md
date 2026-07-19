# Jak założyć konto i projekt w Supabase (krok po kroku)

To instrukcja **tylko do założenia konta i pustego projektu**.  
**Nie** wklejaj jeszcze migracji ani kluczy do aplikacji, dopóki plan Etapu 2 nie zostanie zaakceptowany.

Czas: ok. 10–15 minut.

---

## Część A — Konto Supabase

1. Otwórz w przeglądarce: [https://supabase.com](https://supabase.com)
2. Kliknij **Start your project** albo **Sign in**
3. Najwygodniej: **Continue with GitHub** (to samo konto co do kodu)
4. Jeśli GitHub poprosi o uprawnienia — zaakceptuj
5. Po wejściu zobaczysz panel (Dashboard)

---

## Część B — Nowy projekt (jeszcze pusty)

1. Kliknij **New project**
2. Wybierz organizację (zwykle Twoja domyślna — OK)
3. Wypełnij:

| Pole | Co wpisać |
|------|-----------|
| **Project name** | `nasz-budzet` (lub `Nasz Budzet`) |
| **Database password** | Silne hasło — **zapisz je w menedżerze haseł**. To hasło do bazy, nie do logowania w aplikacji. |
| **Region** | Najbliżej Polski, np. **Frankfurt (eu-central-1)** albo inny region UE |
| **Pricing plan** | **Free** |

4. Kliknij **Create new project**
5. Poczekaj 1–2 minuty, aż status będzie gotowy (zielony / „Project is ready”)

Na tym etapie **wystarczy pusty projekt**. Nie dodawaj jeszcze tabel ręcznie w Table Editor — zrobi to migracja po akceptacji planu.

---

## Część C — Co zobaczysz (na razie tylko podejrzyj)

Po akceptacji planu Etapu 2 będziemy potrzebować z menu:

1. **Project Settings** (ikona koła zębatego) → **API**
2. Stamtąd skopiujesz później:
   - **Project URL**
   - **anon public** key  
3. **service_role** key — pokażemy dokładnie, jak go użyć **tylko lokalnie**; nie wklejaj go nigdzie publicznie i nie wysyłaj na czat bez potrzeby.

**Teraz nie musisz jeszcze nic kopiować do aplikacji.**

---

## Część D — Auth (podejrzyj, nie konfiguruj na siłę)

Menu: **Authentication** → **Providers**

- Powinien być włączony **Email**
- Po akceptacji planu: wyłączymy na czas testów **Confirm email** (żeby nie czekać na maile przy kontach testowych)

Nie twórz jeszcze użytkowników ręcznie — zrobi to ekran rejestracji w aplikacji.

---

## Część E — Dwa e-maile testowe (przygotuj na później)

Przykłady (fikcyjne konta aplikacji, nie prawdziwe finanse):

- `twojemail+pawel@gmail.com`
- `twojemail+milena@gmail.com`

(Gmail dostarcza oba na tę samą skrzynkę.)

Hasła testowe zapisz u siebie — nie w Git.

---

## Checklist przed „Start Etap 2”

- [ ] Mam konto na supabase.com
- [ ] Mam utworzony projekt (np. `nasz-budzet`) na planie Free
- [ ] Zapisane hasło bazy
- [ ] Znam region projektu
- [ ] Mam (lub będę mieć) 2 e-maile testowe
- [ ] Zaakceptowałem `docs/ETAP_2_PLAN.md`

Gdy to zrobisz, napisz w Cursorze np.:

> Akceptuję plan Etapu 2. Projekt Supabase mam. Start Etap 2.
