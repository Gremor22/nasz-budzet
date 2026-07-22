/**
 * Etap 8 — prawdziwy test integracyjny (dwa klienty Supabase / JWT).
 *
 * NIE jest w domyślnym npm test (vitest include = src test files).
 *
 * Uruchomienie (po wdrożeniu migracji + seedzie kont testowych):
 *
 *   ETAP8_INTEGRATION=1 \
 *   NEXT_PUBLIC_SUPABASE_URL=... \
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
 *   ETAP8_OWNER_EMAIL=... ETAP8_OWNER_PASSWORD=... \
 *   ETAP8_MEMBER_EMAIL=... ETAP8_MEMBER_PASSWORD=... \
 *   ETAP8_OUTSIDER_EMAIL=... ETAP8_OUTSIDER_PASSWORD=... \
 *   ETAP8_HOUSEHOLD_ID=... \
 *   npx vitest run docs/etap8/etap8.concurrency.integration.test.ts
 *
 * Destrukcyjny kick (wymaga reseed membership):
 *   ETAP8_DESTRUCTIVE=1 ... (jak wyżej)
 *
 * Wymaga: @supabase/supabase-js (już w projekcie).
 *
 * Logika dat: patrz etap8_list_occurrences.test.sql.
 * Onboarding: patrz ONBOARDING_FLOW.md.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

const enabled = process.env.ETAP8_INTEGRATION === "1";
const destructive = process.env.ETAP8_DESTRUCTIVE === "1";

async function authedClient(
  email: string,
  password: string,
): Promise<SupabaseClient> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return client;
}

describe.skipIf(!enabled)("Etap 8 concurrency + RLS (integration)", () => {
  const hh = process.env.ETAP8_HOUSEHOLD_ID!;

  it("Promise.all sync ×2 → max 1 auto row per occurrence", async () => {
    const a = await authedClient(
      process.env.ETAP8_OWNER_EMAIL!,
      process.env.ETAP8_OWNER_PASSWORD!,
    );
    const b = await authedClient(
      process.env.ETAP8_MEMBER_EMAIL!,
      process.env.ETAP8_MEMBER_PASSWORD!,
    );

    const [r1, r2] = await Promise.all([
      a.rpc("sync_income_source_transactions", { p_household_id: hh }),
      b.rpc("sync_income_source_transactions", { p_household_id: hh }),
    ]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();

    const { data, error } = await a
      .from("transactions")
      .select("household_id, income_source_id, occurrence_key")
      .eq("household_id", hh)
      .eq("is_auto_generated", true)
      .not("income_source_id", "is", null);

    expect(error).toBeNull();
    const key = (row: {
      household_id: string;
      income_source_id: string;
      occurrence_key: string;
    }) => `${row.household_id}|${row.income_source_id}|${row.occurrence_key}`;
    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      const k = key(row as never);
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const [, n] of counts) expect(n).toBe(1);
  });

  it("Promise.all complete_simple_setup ×2 → jedno konto primary + jedna pensja slot", async () => {
    const a = await authedClient(
      process.env.ETAP8_OWNER_EMAIL!,
      process.env.ETAP8_OWNER_PASSWORD!,
    );
    const b = await authedClient(
      process.env.ETAP8_OWNER_EMAIL!,
      process.env.ETAP8_OWNER_PASSWORD!,
    );

    // person_key musi zgadzać się z membership callera (owner seed = pawel)
    const args = {
      p_household_id: hh,
      p_person_key: "pawel",
      p_my_balance_grosze: 12345,
      p_income_name: "Pensja Etap8 Test",
      p_income_amount_grosze: 500000,
      p_income_day_of_month: 10,
    };

    const [r1, r2] = await Promise.all([
      a.rpc("complete_simple_setup", args),
      b.rpc("complete_simple_setup", args),
    ]);
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();

    const { data: accounts } = await a
      .from("accounts")
      .select("id")
      .eq("household_id", hh)
      .eq("setup_slot", "primary_pawel");
    expect(accounts?.length).toBe(1);

    const { data: incomes } = await a
      .from("income_sources")
      .select("id")
      .eq("household_id", hh)
      .eq("setup_slot", "primary_income_pawel");
    expect(incomes?.length).toBe(1);
  });

  it("member complete_simple_setup with wrong person_key → error", async () => {
    const member = await authedClient(
      process.env.ETAP8_MEMBER_EMAIL!,
      process.env.ETAP8_MEMBER_PASSWORD!,
    );

    // Member ma person_key z membership; podanie cudzego (drugiej osoby) musi failować.
    const { data: membership, error: memErr } = await member
      .from("household_members")
      .select("person_key")
      .eq("household_id", hh)
      .single();
    expect(memErr).toBeNull();
    const mine = membership?.person_key;
    expect(mine === "pawel" || mine === "milena").toBe(true);
    const spoof = mine === "pawel" ? "milena" : "pawel";

    const { error } = await member.rpc("complete_simple_setup", {
      p_household_id: hh,
      p_person_key: spoof,
      p_my_balance_grosze: 100,
    });
    expect(error).not.toBeNull();
    expect(error?.message ?? "").toMatch(/person_key does not match membership/i);
  });

  it("claim_my_person_key smoke: idempotent same key", async () => {
    const owner = await authedClient(
      process.env.ETAP8_OWNER_EMAIL!,
      process.env.ETAP8_OWNER_PASSWORD!,
    );

    const { data: membership, error: memErr } = await owner
      .from("household_members")
      .select("person_key")
      .eq("household_id", hh)
      .single();
    expect(memErr).toBeNull();
    const key = membership?.person_key;
    expect(key === "pawel" || key === "milena").toBe(true);

    const { error: e1 } = await owner.rpc("claim_my_person_key", {
      p_household_id: hh,
      p_person_key: key,
    });
    expect(e1).toBeNull();

    const { error: e2 } = await owner.rpc("claim_my_person_key", {
      p_household_id: hh,
      p_person_key: key,
    });
    expect(e2).toBeNull();

    const other = key === "pawel" ? "milena" : "pawel";
    const { error: e3 } = await owner.rpc("claim_my_person_key", {
      p_household_id: hh,
      p_person_key: other,
    });
    expect(e3).not.toBeNull();
    expect(e3?.message ?? "").toMatch(/person_key already set/i);
  });

  it("two manual transactions same source same day both allowed", async () => {
    const owner = await authedClient(
      process.env.ETAP8_OWNER_EMAIL!,
      process.env.ETAP8_OWNER_PASSWORD!,
    );

    const { data: source, error: srcErr } = await owner
      .from("income_sources")
      .select("id, owner_key, name")
      .eq("household_id", hh)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    expect(srcErr).toBeNull();
    expect(source?.id).toBeTruthy();

    const { data: account, error: accErr } = await owner
      .from("accounts")
      .select("id")
      .eq("household_id", hh)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    expect(accErr).toBeNull();
    expect(account?.id).toBeTruthy();

    const day = "2026-07-15";
    const base = {
      household_id: hh,
      account_id: account!.id,
      type: "income" as const,
      amount_grosze: 111,
      txn_date: day,
      description: "Manual Etap8 A",
      category_name: "Wpływ",
      person_key: source!.owner_key,
      paid_by: source!.owner_key,
      is_shared: false,
      status: "planned",
      income_source_id: source!.id,
      occurrence_key: null,
      is_auto_generated: false,
      generated_by: null,
    };

    const { error: e1 } = await owner.from("transactions").insert(base);
    expect(e1).toBeNull();

    const { error: e2 } = await owner.from("transactions").insert({
      ...base,
      description: "Manual Etap8 B",
      amount_grosze: 222,
    });
    expect(e2).toBeNull();

    const { data: manuals, error: qErr } = await owner
      .from("transactions")
      .select("id")
      .eq("household_id", hh)
      .eq("income_source_id", source!.id)
      .eq("txn_date", day)
      .eq("is_auto_generated", false)
      .is("occurrence_key", null);
    expect(qErr).toBeNull();
    expect((manuals ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("manual income blocks new auto for same source+date (no double)", async () => {
    const owner = await authedClient(
      process.env.ETAP8_OWNER_EMAIL!,
      process.env.ETAP8_OWNER_PASSWORD!,
    );

    const day = "2026-07-20";

    const { data: inserted, error: insErr } = await owner
      .from("income_sources")
      .insert({
        household_id: hh,
        name: "Etap8 Manual Block Source",
        owner_key: "pawel",
        typical_amount_grosze: 99900,
        safe_amount_grosze: 99900,
        frequency: "monthly_on_day",
        day_of_month: 20,
        next_occurrence_date: day,
        confidence: "expected",
        active: true,
        note: "etap8_integration_manual_block",
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    expect(inserted?.id).toBeTruthy();

    const { data: account, error: accErr } = await owner
      .from("accounts")
      .select("id")
      .eq("household_id", hh)
      .eq("active", true)
      .limit(1)
      .maybeSingle();
    expect(accErr).toBeNull();
    expect(account?.id).toBeTruthy();

    const { error: manErr } = await owner.from("transactions").insert({
      household_id: hh,
      account_id: account!.id,
      type: "income",
      amount_grosze: 88800,
      txn_date: day,
      description: "Manual blocks auto",
      category_name: "Wpływ",
      person_key: "pawel",
      paid_by: "pawel",
      is_shared: false,
      status: "paid",
      income_source_id: inserted!.id,
      occurrence_key: null,
      is_auto_generated: false,
      generated_by: null,
    });
    expect(manErr).toBeNull();

    const { error: syncErr } = await owner.rpc("sync_income_source_transactions", {
      p_household_id: hh,
      p_as_of: "2026-07-21",
    });
    expect(syncErr).toBeNull();

    const { data: incomes, error: qErr } = await owner
      .from("transactions")
      .select("id, is_auto_generated")
      .eq("household_id", hh)
      .eq("income_source_id", inserted!.id)
      .eq("txn_date", day)
      .eq("type", "income");
    expect(qErr).toBeNull();
    expect(incomes ?? []).toHaveLength(1);
    expect(incomes![0].is_auto_generated).toBe(false);

    await owner.from("transactions").delete().eq("income_source_id", inserted!.id);
    await owner.from("income_sources").delete().eq("id", inserted!.id);
  });

  it("next_occurrence w przyszłym miesiącu → brak historycznego auto w lipcu", async () => {
    const owner = await authedClient(
      process.env.ETAP8_OWNER_EMAIL!,
      process.env.ETAP8_OWNER_PASSWORD!,
    );

    const { data: inserted, error: insErr } = await owner
      .from("income_sources")
      .insert({
        household_id: hh,
        name: "Etap8 Future Next",
        owner_key: "pawel",
        typical_amount_grosze: 100000,
        safe_amount_grosze: 100000,
        frequency: "monthly_on_day",
        day_of_month: 10,
        next_occurrence_date: "2026-08-10",
        confidence: "expected",
        active: true,
        note: "etap8_integration_future_next",
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    expect(inserted?.id).toBeTruthy();

    const { error: syncErr } = await owner.rpc("sync_income_source_transactions", {
      p_household_id: hh,
      p_as_of: "2026-07-21",
    });
    expect(syncErr).toBeNull();

    const { data: julyAuto, error: qErr } = await owner
      .from("transactions")
      .select("id, occurrence_key")
      .eq("household_id", hh)
      .eq("income_source_id", inserted!.id)
      .eq("is_auto_generated", true)
      .gte("occurrence_key", "2026-07-01")
      .lte("occurrence_key", "2026-07-31");
    expect(qErr).toBeNull();
    expect(julyAuto ?? []).toHaveLength(0);

    await owner.from("income_sources").delete().eq("id", inserted!.id);
  });

  it("p_horizon_days cross-month: as_of 2026-07-28 + 40 → August auto exists, not deleted", async () => {
    const owner = await authedClient(
      process.env.ETAP8_OWNER_EMAIL!,
      process.env.ETAP8_OWNER_PASSWORD!,
    );

    const { data: inserted, error: insErr } = await owner
      .from("income_sources")
      .insert({
        household_id: hh,
        name: "Etap8 Horizon Aug",
        owner_key: "pawel",
        typical_amount_grosze: 150000,
        safe_amount_grosze: 150000,
        frequency: "monthly_on_day",
        day_of_month: 10,
        next_occurrence_date: "2026-08-10",
        confidence: "expected",
        active: true,
        note: "etap8_integration_horizon",
      })
      .select("id")
      .single();
    expect(insErr).toBeNull();
    expect(inserted?.id).toBeTruthy();

    const { error: syncErr } = await owner.rpc("sync_income_source_transactions", {
      p_household_id: hh,
      p_as_of: "2026-07-28",
      p_horizon_days: 40,
    });
    expect(syncErr).toBeNull();

    const { data: augAuto, error: qErr } = await owner
      .from("transactions")
      .select("id, occurrence_key, status")
      .eq("household_id", hh)
      .eq("income_source_id", inserted!.id)
      .eq("is_auto_generated", true)
      .eq("occurrence_key", "2026-08-10");
    expect(qErr).toBeNull();
    expect(augAuto ?? []).toHaveLength(1);

    // Re-sync z tym samym horizonem nie kasuje sierpniowego auto
    const { error: sync2Err } = await owner.rpc("sync_income_source_transactions", {
      p_household_id: hh,
      p_as_of: "2026-07-28",
      p_horizon_days: 40,
    });
    expect(sync2Err).toBeNull();

    const { data: still, error: q2Err } = await owner
      .from("transactions")
      .select("id")
      .eq("household_id", hh)
      .eq("income_source_id", inserted!.id)
      .eq("is_auto_generated", true)
      .eq("occurrence_key", "2026-08-10");
    expect(q2Err).toBeNull();
    expect(still ?? []).toHaveLength(1);

    await owner.from("transactions").delete().eq("income_source_id", inserted!.id);
    await owner.from("income_sources").delete().eq("id", inserted!.id);
  });

  it("outsider nie czyta transactions (RLS)", async () => {
    const outsider = await authedClient(
      process.env.ETAP8_OUTSIDER_EMAIL!,
      process.env.ETAP8_OUTSIDER_PASSWORD!,
    );
    const { data, error } = await outsider
      .from("transactions")
      .select("id")
      .eq("household_id", hh);
    expect(error).toBeNull();
    expect(data ?? []).toHaveLength(0);
  });

  /**
   * DESTRUCTIVE: remove_household_member permanently drops membership.
   * Requires reseed of ETAP8_MEMBER before re-running the suite.
   * Skipped unless ETAP8_DESTRUCTIVE=1.
   */
  describe.skipIf(!destructive)("destructive kick (requires reseed)", () => {
    it("[DESTRUCTIVE] po kick member traci SELECT — requires reseed", async () => {
      const owner = await authedClient(
        process.env.ETAP8_OWNER_EMAIL!,
        process.env.ETAP8_OWNER_PASSWORD!,
      );
      const member = await authedClient(
        process.env.ETAP8_MEMBER_EMAIL!,
        process.env.ETAP8_MEMBER_PASSWORD!,
      );
      const {
        data: { user: memberUser },
      } = await member.auth.getUser();
      expect(memberUser?.id).toBeTruthy();

      const before = await member
        .from("transactions")
        .select("id")
        .eq("household_id", hh)
        .limit(1);
      expect(before.error).toBeNull();

      const { error: kickErr } = await owner.rpc("remove_household_member", {
        p_household_id: hh,
        p_user_id: memberUser!.id,
      });
      expect(kickErr).toBeNull();

      const after = await member
        .from("transactions")
        .select("id")
        .eq("household_id", hh);
      expect(after.error).toBeNull();
      expect(after.data ?? []).toHaveLength(0);
    });
  });
});
