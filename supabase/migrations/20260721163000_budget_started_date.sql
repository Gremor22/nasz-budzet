-- Data rozpoczęcia korzystania z budżetu (pensje liczone od tego miesiąca).
ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS budget_started_date DATE;

UPDATE public.households
SET budget_started_date = date_trunc('month', created_at)::date
WHERE budget_started_date IS NULL;
