# Etap 8 — onboarding flow (person_key claim)

Po Etapie 8 membership **nie** dostaje automatycznie `person_key`. Claim jest wymagany przed `complete_simple_setup`.

## Owner

```
signup
  → create_household(name)                    -- membership.person_key = NULL
  → claim_my_person_key(hh, 'pawel')          -- zajmuje slot (idempotent)
  → complete_simple_setup(...)                -- czyta person_key z membership
```

Opcjonalnie w jednej transakcji RPC: `create_household(name, 'pawel')` — insert z NULL, potem claim w tym samym wywołaniu.

## Partner

```
signup
  → accept_invitation(code)                   -- membership.person_key = NULL, bez konta osobistego
  → claim_my_person_key(hh, 'milena', balance) -- claim + opening balance → konto osobiste
  → (optional) complete_simple_setup / sync   -- jeśli potrzebne
```

Opcjonalnie: `accept_invitation(code, 'milena', balance)` — join + claim + konto w jednej txn.

## Zasady claim (`claim_my_person_key`)

| Warunek | Wynik |
|---------|--------|
| `person_key IS NULL` + wolny slot | UPDATE własnego wiersza |
| Już ten sam klucz | no-op (sukces) |
| Już inny nie-null | błąd `person_key already set` |
| Slot zajęty przez innego | `Person slot already taken: %` |
| Race (unique index) | ten sam czytelny błąd |
| `p_opening_balance_grosze` podane | create/update konta osobistego |

`set_my_person_key` wywołuje ten sam claim (bez salda).

## Dlaczego

`complete_simple_setup` wymaga `membership.person_key ∈ {pawel, milena}` i odrzuca spoofing z klienta. NULL membership bez claim → setup failuje z jasnym komunikatem zamiast auto-assign.
