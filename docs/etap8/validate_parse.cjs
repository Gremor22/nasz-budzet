/**
 * Parser smoke-check for docs/etap8/02_migration.sql
 * Rewrites trailing COMMIT → ROLLBACK and parses via libpg-query.
 *
 *   node docs/etap8/validate_parse.cjs
 *
 * Not a live Postgres execution on empty DB (requires local psql).
 */
const fs = require("fs");
const path = require("path");
const pq = require("libpg-query");

async function main() {
  await pq.loadModule();
  const file = path.join(__dirname, "02_migration.sql");
  const raw = fs.readFileSync(file, "utf8");
  if (!/^\s*BEGIN;/m.test(raw)) {
    throw new Error("Expected BEGIN; at start of migration");
  }
  if (!/\nCOMMIT;\s*$/.test(raw)) {
    throw new Error("Expected trailing COMMIT;");
  }
  const sql = raw.replace(/\nCOMMIT;\s*$/, "\nROLLBACK;\n");
  const result = await pq.parse(sql);
  if (!result.stmts?.length) {
    throw new Error("Parse returned no statements");
  }
  const first = result.stmts[0]?.stmt;
  const last = result.stmts[result.stmts.length - 1]?.stmt;
  if (!first?.TransactionStmt || first.TransactionStmt.kind !== "TRANS_STMT_BEGIN") {
    throw new Error("First stmt is not BEGIN");
  }
  if (!last?.TransactionStmt || last.TransactionStmt.kind !== "TRANS_STMT_ROLLBACK") {
    throw new Error("Last stmt is not ROLLBACK (after COMMIT→ROLLBACK rewrite)");
  }
  console.log(
    `OK: parsed ${result.stmts.length} statements, BEGIN → … → ROLLBACK (COMMIT rewritten)`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
