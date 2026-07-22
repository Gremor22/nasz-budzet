#!/usr/bin/env bash
# =============================================================================
# Etap 8 — pełny stack na osobnym projekcie TEST (NIE produkcja).
#
# Wymaga:
#   ETAP8_TEST_DATABASE_URL  — connection string Postgres testowego projektu
#                              (Settings → Database → URI, role postgres)
#   LUB
#   ETAP8_TEST_SUPABASE_URL + ETAP8_TEST_SERVICE_ROLE_KEY — wtedy użyj
#   docs/etap8/run_test_via_sql_editor.md (REST nie wykonuje dowolnego SQL).
#
# Użycie:
#   export ETAP8_TEST_DATABASE_URL='postgresql://postgres....'
#   ./docs/etap8/apply_test_stack.sh
#
# Kroki: wszystkie supabase/migrations → 02_migration → postflight
#         (preflight przed etap8 na pustej bazie jest prawie pusty)
# Rollback: osobno na KOPII: docs/etap8/03_rollback_restore.sql
# =============================================================================
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${ETAP8_TEST_DATABASE_URL:-}"

if [[ -z "$DB" ]]; then
  echo "Brak ETAP8_TEST_DATABASE_URL. Podaj connection string testowego projektu Supabase."
  echo "NIE używaj produkcyjnego netwpfhqjyhetntcxfyf."
  exit 1
fi

# Guard: odmów jeśli URL wygląda na znany produkcyjny ref
if echo "$DB" | grep -qi 'netwpfhqjyhetntcxfyf'; then
  echo "ABORT: wygląda na produkcję (netwpfhqjyhetntcxfyf). Użyj osobnego projektu testowego."
  exit 1
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "Brak psql. Zainstaluj: brew install libpq && brew link --force libpq"
  exit 1
fi

run() {
  local f="$1"
  echo "=== APPLY: $f ==="
  psql "$DB" -v ON_ERROR_STOP=1 -f "$f"
}

# Kolejność = nazwy plików migracji
for f in "$ROOT"/supabase/migrations/*.sql; do
  run "$f"
done

echo "=== PREFLIGHT (SELECT) ==="
psql "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/docs/etap8/01_preflight.sql" || true

echo "=== ETAP 8 MIGRATION ==="
run "$ROOT/docs/etap8/02_migration.sql"

echo "=== OCCURRENCE UNIT TEST (BEGIN..ROLLBACK) ==="
psql "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/docs/etap8/etap8_list_occurrences.test.sql"

echo "=== POSTFLIGHT ==="
psql "$DB" -v ON_ERROR_STOP=1 -f "$ROOT/docs/etap8/05_postflight.sql"

echo "OK: stack + etap8 na teście. Integracja JWT: ETAP8_INTEGRATION=1 vitest …"
echo "Rollback na KOPII: psql \"\$COPY_URL\" -f docs/etap8/03_rollback_restore.sql"
