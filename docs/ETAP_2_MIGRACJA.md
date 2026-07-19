# Etap 2 — Wyjaśnienie migracji i RLS

Plik SQL: `supabase/migrations/20260719150000_stage2_core.sql`

## Tabele (prosty język)

| Tabela | Co to jest |
|--------|------------|
| **profiles** | Twój profil (imię). Jeden wiersz na konto logowania. |
| **households** | Gospodarstwo (np. „Paweł i Milena”): nazwa, bufor, tryb prognozy. |
| **household_members** | Lista osób w gospodarstwie + rola (właściciel / członek). |
| **household_invitations** | Zaproszenia z kodem (ważność, kto użył). |
| **accounts** | Konta pieniężne (wspólne, osobiste, gotówka) — bez banku. |
| **categories** | Kategorie wydatków (z możliwością kategorii nadrzędnej). |
| **income_sources** | Źródła dochodu: typowa kwota, bezpieczna kwota, cykl, pewność. |
| **recurring_bills** | Rachunki powtarzalne (czynsz, prąd…). |
| **transactions** | Pojedyncze wpływy i wydatki. |
| **savings_goals** | Cele oszczędnościowe; `reserved` = zmniejsza „bezpiecznie do wydania”. |
| **audit_logs** | Krótki zapis: kto utworzył gospodarstwo / przyjął zaproszenie. |

## Funkcje pomocnicze (RPC)

| Funkcja | Po co |
|---------|--------|
| `create_household(nazwa)` | Tworzy gospodarstwo i dodaje Cię jako właściciela (bezpiecznie mimo RLS). |
| `create_invitation(id, dni)` | Generuje 8-znakowy kod zaproszenia. |
| `accept_invitation(kod)` | Dołącza Cię do gospodarstwa po kodzie. |
| `is_household_member(id)` | Używane w politykach: „czy należysz do tego HH?” |

## Checklist RLS

| Tabela | RLS włączone | FORCE RLS | Polityki |
|--------|--------------|-----------|----------|
| profiles | tak | tak | SELECT własne/współczłonkowie; UPDATE własne |
| households | tak | tak | SELECT/UPDATE członek; INSERT tylko przez RPC |
| household_members | tak | tak | SELECT członek; INSERT przez RPC |
| household_invitations | tak | tak | SELECT/INSERT/UPDATE członek |
| accounts | tak | tak | pełny CRUD dla członka |
| categories | tak | tak | pełny CRUD dla członka |
| income_sources | tak | tak | pełny CRUD dla członka |
| recurring_bills | tak | tak | pełny CRUD dla członka |
| transactions | tak | tak | pełny CRUD dla członka |
| savings_goals | tak | tak | pełny CRUD dla członka |
| audit_logs | tak | tak | SELECT + INSERT; bez UPDATE/DELETE |

**Rola `anon`:** brak GRANT do tabel finansowych.  
**Rola `authenticated`:** dostęp tylko przez RLS.  
**`service_role`:** nie używamy w przeglądarce ani w tym etapie w kodzie klienta.

## Jak wkleić migrację w Supabase

1. Panel projektu → **SQL Editor** → **New query**
2. Otwórz plik `supabase/migrations/20260719150000_stage2_core.sql`
3. Skopiuj całą zawartość → wklej → **Run**
4. Sprawdź: **Table Editor** — powinny pojawić się tabele
5. **Authentication → Providers → Email**: na czas testów wyłącz **Confirm email**
