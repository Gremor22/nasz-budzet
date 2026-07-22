-- =============================================================================
-- ETAP 8 — unit test: etap8_list_occurrences (lokalna walidacja)
--
-- Asserts:
--   1) source created 2026-07-01, next 2026-08-10, window July → empty array
--   2) window July 1 – Aug 31, next Aug 10, created July 1 → contains 2026-08-10
--   3) as_of July 28 + horizon 40 → window end Aug 6 includes August 10
-- Tworzy helpery tymczasowo w transakcji i rollback na końcu (nie zostawia śladów).
-- =============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.etap8_last_business_day(p_month DATE)
RETURNS DATE
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d DATE := (date_trunc('month', p_month) + INTERVAL '1 month - 1 day')::date;
BEGIN
  WHILE EXTRACT(ISODOW FROM d) IN (6, 7) LOOP
    d := d - 1;
  END LOOP;
  RETURN d;
END;
$$;

CREATE OR REPLACE FUNCTION public.etap8_list_occurrences(
  p_frequency TEXT,
  p_next_occurrence DATE,
  p_end_date DATE,
  p_day_of_month INT,
  p_source_created DATE,
  p_window_start DATE,
  p_window_end DATE
)
RETURNS DATE[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_start DATE := GREATEST(p_window_start, p_source_created, p_next_occurrence);
  v_end DATE := LEAST(p_window_end, COALESCE(p_end_date, '9999-12-31'::date));
  v_cursor DATE;
  v_out DATE[] := ARRAY[]::DATE[];
  v_day INT;
  v_month DATE;
  v_occ DATE;
  v_guard INT := 0;
  v_step INT;
BEGIN
  IF p_frequency IS NULL OR p_frequency = 'irregular' THEN
    RETURN v_out;
  END IF;

  IF p_next_occurrence IS NULL OR v_start > v_end THEN
    RETURN v_out;
  END IF;

  IF p_frequency = 'once' THEN
    IF p_next_occurrence >= v_start AND p_next_occurrence <= v_end THEN
      v_out := array_append(v_out, p_next_occurrence);
    END IF;
    RETURN v_out;
  END IF;

  IF p_frequency IN ('monthly_on_day', 'monthly') THEN
    v_day := COALESCE(p_day_of_month, EXTRACT(DAY FROM p_next_occurrence)::int);
    v_month := date_trunc('month', v_start)::date;

    WHILE v_month <= date_trunc('month', v_end)::date AND v_guard < 240 LOOP
      v_guard := v_guard + 1;
      v_occ := make_date(
        EXTRACT(YEAR FROM v_month)::int,
        EXTRACT(MONTH FROM v_month)::int,
        LEAST(
          v_day,
          EXTRACT(DAY FROM (date_trunc('month', v_month) + INTERVAL '1 month - 1 day'))::int
        )
      );

      IF v_occ >= v_start AND v_occ <= v_end THEN
        v_out := array_append(v_out, v_occ);
      END IF;

      v_month := (v_month + INTERVAL '1 month')::date;
    END LOOP;

    RETURN v_out;
  END IF;

  IF p_frequency = 'last_business_day' THEN
    v_cursor := public.etap8_last_business_day(v_start);
    IF v_cursor < v_start THEN
      v_cursor := public.etap8_last_business_day(
        (date_trunc('month', v_start) + INTERVAL '1 month')::date
      );
    END IF;

    WHILE v_cursor <= v_end AND v_guard < 240 LOOP
      v_guard := v_guard + 1;
      IF v_cursor >= v_start THEN
        v_out := array_append(v_out, v_cursor);
      END IF;
      v_cursor := public.etap8_last_business_day(
        (date_trunc('month', v_cursor) + INTERVAL '1 month')::date
      );
    END LOOP;

    RETURN v_out;
  END IF;

  IF p_frequency IN ('weekly', 'biweekly') THEN
    v_step := CASE WHEN p_frequency = 'weekly' THEN 7 ELSE 14 END;
    v_cursor := p_next_occurrence;

    WHILE v_cursor < v_start AND v_guard < 520 LOOP
      v_guard := v_guard + 1;
      v_cursor := v_cursor + v_step;
    END LOOP;

    v_guard := 0;
    WHILE v_cursor <= v_end AND v_guard < 520 LOOP
      v_guard := v_guard + 1;
      IF v_cursor >= v_start THEN
        v_out := array_append(v_out, v_cursor);
      END IF;
      v_cursor := v_cursor + v_step;
    END LOOP;

    RETURN v_out;
  END IF;

  RETURN v_out;
END;
$$;

DO $$
DECLARE
  v_result DATE[];
  v_as_of DATE := '2026-07-28'::date;
  v_horizon INT := 40;
  v_window_end DATE;
BEGIN
  -- 1) source created 2026-07-01, next 2026-08-10, window July → []
  v_result := public.etap8_list_occurrences(
    'monthly_on_day',
    '2026-08-10'::date,   -- next_occurrence
    NULL,                 -- end_date
    10,                   -- day_of_month
    '2026-07-01'::date,   -- source_created
    '2026-07-01'::date,   -- window_start (July)
    '2026-07-31'::date    -- window_end
  );

  IF v_result IS DISTINCT FROM ARRAY[]::DATE[] THEN
    RAISE EXCEPTION
      'etap8_list_occurrences July window with next Aug failed: expected [], got %',
      v_result;
  END IF;

  RAISE NOTICE 'OK: July window + next 2026-08-10 → []';

  -- 2) window July 1 – Aug 31, next Aug 10, created July 1 → contains 2026-08-10 (not July)
  v_result := public.etap8_list_occurrences(
    'monthly_on_day',
    '2026-08-10'::date,
    NULL,
    10,
    '2026-07-01'::date,
    '2026-07-01'::date,
    '2026-08-31'::date
  );

  IF NOT ('2026-08-10'::date = ANY (v_result)) THEN
    RAISE EXCEPTION
      'cross-month window failed: expected 2026-08-10 in %, got %',
      v_result, v_result;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_result) d
    WHERE d >= '2026-07-01'::date AND d <= '2026-07-31'::date
  ) THEN
    RAISE EXCEPTION
      'cross-month window failed: July date should not appear, got %',
      v_result;
  END IF;

  RAISE NOTICE 'OK: July–Aug window + next 2026-08-10 → contains Aug 10, not July';

  -- 3) as_of July 28, horizon 40 days → window end includes August
  v_window_end := (v_as_of + GREATEST(0, LEAST(v_horizon, 365)))::date;
  -- 2026-07-28 + 40 = 2026-09-06
  IF v_window_end < '2026-08-10'::date THEN
    RAISE EXCEPTION 'horizon window end % does not reach Aug 10', v_window_end;
  END IF;

  v_result := public.etap8_list_occurrences(
    'monthly_on_day',
    '2026-08-10'::date,
    NULL,
    10,
    '2026-07-01'::date,
    date_trunc('month', v_as_of)::date,
    v_window_end
  );

  IF NOT ('2026-08-10'::date = ANY (v_result)) THEN
    RAISE EXCEPTION
      'horizon 40 from 2026-07-28 failed: expected 2026-08-10 in window ending %, got %',
      v_window_end, v_result;
  END IF;

  RAISE NOTICE 'OK: as_of 2026-07-28 + horizon 40 → August in window (end=%)', v_window_end;
END $$;

ROLLBACK;
