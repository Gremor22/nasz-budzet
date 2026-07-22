# Etap 8 — backup + dump RPC przed preflightem (produkcja)

**Teraz:** wykonaj TYLKO backup i dump (poniżej).  
**Preflight:** dopiero po Twoim potwierdzeniu (np. „potwierdzam backup, uruchom preflight”).  
**Migracja:** nadal zakazana.

Katalog wyników lokalnych:

```text
/Users/damiangronkowski/Desktop/BudgetPlanner/docs/etap8/prod-run/
```

(jest w `.gitignore` — nie pójdzie do Gita)

---

## 1. Backup bazy (Dashboard — zalecane)

1. Otwórz: [Supabase Dashboard](https://supabase.com/dashboard) → projekt **nasz-budzet** (`netwpfhqjyhetntcxfyf`).
2. **Project Settings → Database** (lub **Backups**).
3. Upewnij się, że masz aktualny backup / włączony PITR (jeśli plan Pro).
4. Zanotuj czas: `backup przed Etap 8 preflight — YYYY-MM-DD HH:MM`.

Opcjonalnie pełny dump (wymaga hasła DB z **Database → Connection string → URI**):

```bash
cd /Users/damiangronkowski/Desktop/BudgetPlanner
mkdir -p docs/etap8/prod-run
export PROD_DATABASE_URL='postgresql://postgres.[REF]:[HASLO]@aws-0-….pooler.supabase.com:5432/postgres'
# NIE wklejaj tego do chatu / Gita

# wymaga: brew install libpq && brew link --force libpq
pg_dump "$PROD_DATABASE_URL" \
  --format=custom --no-owner --no-acl \
  -f "docs/etap8/prod-run/nasz-budzet-pre-etap8-$(date +%Y%m%d-%H%M).dump"

ls -lh docs/etap8/prod-run/*.dump
# plik musi mieć rozmiar > 0 (zwykle setki KB – MB)
```

---

## 2. Dump definicji 4 funkcji (obowiązkowy przed migracją)

### Wariant A — Supabase SQL Editor (bez psql)

1. SQL Editor → **New query**.
2. Wklej i **Run**:

```sql
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'complete_simple_setup',
    'reset_household_budget',
    'create_invitation',
    'remove_household_member'
  )
ORDER BY p.proname, 2;
```

3. Wynik: **Download CSV** (lub skopiuj kolumnę `definition`).
4. Zapisz jako:

```text
docs/etap8/prod-run/rpc-defs-before-etap8.csv
```

albo osobne pliki `.sql` (jeden na funkcję), np.:

```text
docs/etap8/prod-run/complete_simple_setup.sql
docs/etap8/prod-run/reset_household_budget.sql
docs/etap8/prod-run/create_invitation.sql
docs/etap8/prod-run/remove_household_member.sql
```

### Wariant B — psql (gdy masz `PROD_DATABASE_URL` + `psql`)

```bash
cd /Users/damiangronkowski/Desktop/BudgetPlanner
mkdir -p docs/etap8/prod-run

psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -At -F $'\t' -c "
SELECT p.proname || '|' || pg_get_function_identity_arguments(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'complete_simple_setup',
    'reset_household_budget',
    'create_invitation',
    'remove_household_member'
  )
ORDER BY 1;
" | tee docs/etap8/prod-run/rpc-list.txt

for name in complete_simple_setup reset_household_budget create_invitation remove_household_member; do
  psql "$PROD_DATABASE_URL" -v ON_ERROR_STOP=1 -At -c "
    SELECT pg_get_functiondef(p.oid)
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = '${name}'
    ORDER BY p.oid
    LIMIT 1;
  " > "docs/etap8/prod-run/${name}.sql"
done
```

---

## 3. Jak sprawdzić, że pliki nie są puste

```bash
cd /Users/damiangronkowski/Desktop/BudgetPlanner/docs/etap8/prod-run

# lista + rozmiary
ls -lah

# każda definicja RPC musi mieć treść (CREATE FUNCTION / CREATE OR REPLACE)
for f in complete_simple_setup.sql reset_household_budget.sql \
         create_invitation.sql remove_household_member.sql; do
  if [ -f "$f" ]; then
    bytes=$(wc -c < "$f" | tr -d ' ')
    lines=$(wc -l < "$f" | tr -d ' ')
    has_create=$(grep -c -i 'CREATE.*FUNCTION' "$f" || true)
    echo "$f  bytes=$bytes  lines=$lines  has_CREATE_FUNCTION=$has_create"
    if [ "$bytes" -lt 50 ] || [ "$has_create" -lt 1 ]; then
      echo "  → BŁĄD: plik pusty lub bez definicji funkcji"
    else
      echo "  → OK"
    fi
  else
    echo "$f  → BRAK PLIKU (użyj CSV z wariantu A i sprawdź poniżej)"
  fi
done

# jeśli zapisałeś CSV:
if [ -f rpc-defs-before-etap8.csv ]; then
  bytes=$(wc -c < rpc-defs-before-etap8.csv | tr -d ' ')
  rows=$(wc -l < rpc-defs-before-etap8.csv | tr -d ' ')
  echo "rpc-defs-before-etap8.csv  bytes=$bytes  lines=$rows"
  # oczekiwane: lines >= 5 (nagłówek + 4 funkcje) albo >= 4 bez nagłówka
  grep -E 'complete_simple_setup|reset_household_budget|create_invitation|remove_household_member' \
    rpc-defs-before-etap8.csv | cut -d',' -f1 | sort -u
fi
```

**Kryterium OK:**

| Plik | Minimum |
|------|---------|
| `*.dump` (opcjonalny) | `ls -lh` pokazuje rozmiar > 0 |
| każde `*.sql` RPC | `bytes >= 50` i zawiera `CREATE … FUNCTION` |
| `rpc-defs-before-etap8.csv` | zawiera **4** nazwy funkcji |

Jeśli którejś funkcji brakuje w wyniku SQL (`0 rows` dla nazwy) — **zapisz to** (może nie być na prod); wtedy rollback musi to uwzględnić.

---

## 4. Co napisać mi po backupie

Wyślij krótkie potwierdzenie, np.:

```text
Backup Dashboard: OK (czas …)
Dump RPC: OK — 4 pliki w docs/etap8/prod-run/ (lub CSV)
Potwierdzam backup, uruchom preflight
```

Dopiero wtedy uruchomię **wyłącznie** `01_preflight.sql` (SELECT), zapiszę wyniki A–J do `docs/etap8/prod-run/` i dam ocenę GO/NO-GO.

**Bez tego hasła:** zero zapytań na produkcji.
