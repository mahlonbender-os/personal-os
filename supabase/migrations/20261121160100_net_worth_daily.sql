-- UNAPPLIED. Do not run this from the app.
-- A separate scheduled job (outside Personal OS) inserts one row per day from Plaid.
-- The app only reads this table. Until it has rows, the Finance overview falls back
-- to the month-end rows on the Finance sheet's Balances tab.

CREATE TABLE IF NOT EXISTS public.net_worth_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  snapshot_date date NOT NULL,
  total_assets numeric,
  total_liabilities numeric,
  net_worth numeric,
  mahlon_net_worth numeric,
  balances jsonb,
  source text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, snapshot_date)
);

ALTER TABLE public.net_worth_daily ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.net_worth_daily FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON TABLE public.net_worth_daily FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON TABLE public.net_worth_daily FROM authenticated;
  END IF;
END $$;

COMMENT ON TABLE public.net_worth_daily IS
  'Daily net worth filled by an external Plaid job. Personal OS reads it and does not write it.';
