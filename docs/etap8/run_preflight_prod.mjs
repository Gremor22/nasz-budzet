/**
 * Etap 8 preflight runner — TYLKO SELECT (01_preflight.sql).
 *
 * Wymaga jednego z:
 *   PROD_DATABASE_URL  — postgres URI (preferowane)
 *   SUPABASE_SERVICE_ROLE_KEY + NEXT_PUBLIC_SUPABASE_URL — via SQL nie działa bezpośrednio;
 *     dla service role używamy PostgREST tylko częściowo; pełny preflight = psql.
 *
 *   node docs/etap8/run_preflight_prod.mjs
 *
 * Zapisuje wyniki do docs/etap8/prod-run/preflight-*.json|txt
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "../..");
const outDir = path.join(__dirname, "prod-run");
const preflightPath = path.join(__dirname, "01_preflight.sql");

function loadEnvLocal() {
  const p = path.join(root, ".env.local");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (process.env[m[1]] != null && process.env[m[1]] !== "") continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] = v;
  }
}

loadEnvLocal();
fs.mkdirSync(outDir, { recursive: true });

const dbUrl =
  process.env.PROD_DATABASE_URL ||
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  "";

if (!dbUrl) {
  console.error(`
BRAK PROD_DATABASE_URL.

Preflight na produkcji wymaga połączenia Postgres (omija RLS).
Anon key z .env.local NIE wystarczy — RLS ukryłby dane i dał fałszywe GO.

1) Supabase Dashboard → Project Settings → Database → Connection string (URI)
2) Lokalnie (NIE wklejaj hasła do chatu):

   export PROD_DATABASE_URL='postgresql://postgres.…'
   node docs/etap8/run_preflight_prod.mjs

Albo uruchom 01_preflight.sql w SQL Editor i wrzuć CSV do docs/etap8/prod-run/
`);
  process.exit(2);
}

if (/netwpfhqjyhetntcxfyf/i.test(dbUrl)) {
  console.log("Target: production ref netwpfhqjyhetntcxfyf (SELECT-only preflight)");
}

const psql =
  process.env.PSQL_PATH ||
  ["/opt/homebrew/opt/libpq/bin/psql", "/usr/local/opt/libpq/bin/psql", "psql"].find(
    (c) => {
      if (c === "psql") return true;
      try {
        return fs.existsSync(c);
      } catch {
        return false;
      }
    },
  );

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outSql = path.join(outDir, `preflight-full-${stamp}.txt`);
const outMeta = path.join(outDir, `preflight-meta-${stamp}.txt`);

const sql = fs.readFileSync(preflightPath, "utf8");
fs.writeFileSync(
  path.join(outDir, "preflight-input.sql"),
  sql,
  "utf8",
);

const result = spawnSync(
  psql,
  [
    dbUrl,
    "-v",
    "ON_ERROR_STOP=1",
    "-P",
    "pager=off",
    "-f",
    preflightPath,
  ],
  { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 },
);

fs.writeFileSync(
  outSql,
  (result.stdout || "") + (result.stderr ? "\n--- STDERR ---\n" + result.stderr : ""),
  "utf8",
);
fs.writeFileSync(
  outMeta,
  `exit=${result.status}\npsql=${psql}\nat=${stamp}\nbytes_out=${(result.stdout || "").length}\n`,
  "utf8",
);

if (result.status !== 0) {
  console.error("preflight FAILED", result.status);
  console.error(result.stderr || result.stdout);
  process.exit(result.status || 1);
}

console.log("OK wrote", outSql);
console.log("meta", outMeta);
