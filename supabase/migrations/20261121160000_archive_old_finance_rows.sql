-- UNAPPLIED. The app does not run this. Apply it yourself in the Supabase SQL editor
-- when you want the abandoned sheet's rows moved out of the live finance tables.
-- Rows are copied into archive tables first. Nothing is dropped.
--
-- Left in the live tables:
--   * source = 'finance_sheet'  (snapshots from the new Finance sheet)
--   * transactions with plaid_transaction_id set (Plaid still owns those)
--
-- Moved to archive tables:
--   * every other transactions row (the old google_sheets sync, and old in-app logs)
--   * bills that did not come from the new sheet
--   * net_worth_snapshots, the old history the app no longer reads

CREATE TABLE IF NOT EXISTS public.transactions_archive (LIKE public.transactions INCLUDING DEFAULTS);
CREATE TABLE IF NOT EXISTS public.bills_archive (LIKE public.bills INCLUDING DEFAULTS);

INSERT INTO public.transactions_archive
SELECT t.*
FROM public.transactions t
WHERE t.id IS NOT NULL
  AND COALESCE(t.source, '') <> 'finance_sheet'
  AND t.plaid_transaction_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.transactions_archive a WHERE a.id = t.id
  );

DELETE FROM public.transactions t
WHERE t.id IS NOT NULL
  AND COALESCE(t.source, '') <> 'finance_sheet'
  AND t.plaid_transaction_id IS NULL;

INSERT INTO public.bills_archive
SELECT b.*
FROM public.bills b
WHERE b.id IS NOT NULL
  AND COALESCE(b.source, '') <> 'finance_sheet'
  AND NOT EXISTS (
    SELECT 1 FROM public.bills_archive a WHERE a.id = b.id
  );

DELETE FROM public.bills b
WHERE b.id IS NOT NULL
  AND COALESCE(b.source, '') <> 'finance_sheet';

DO $$
BEGIN
  IF to_regclass('public.net_worth_snapshots') IS NULL THEN
    RETURN;
  END IF;

  EXECUTE 'CREATE TABLE IF NOT EXISTS public.net_worth_snapshots_archive (LIKE public.net_worth_snapshots INCLUDING DEFAULTS)';

  IF (SELECT count(*) FROM public.net_worth_snapshots_archive) = 0 THEN
    EXECUTE 'INSERT INTO public.net_worth_snapshots_archive SELECT * FROM public.net_worth_snapshots';
  END IF;

  EXECUTE 'DELETE FROM public.net_worth_snapshots';
END $$;

ALTER TABLE public.transactions_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills_archive ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public.net_worth_snapshots_archive') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.net_worth_snapshots_archive ENABLE ROW LEVEL SECURITY';
  END IF;
END $$;

DO $$
DECLARE
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['transactions_archive', 'bills_archive', 'net_worth_snapshots_archive']
  LOOP
    IF to_regclass('public.' || tbl) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', tbl);
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', tbl);
    END IF;
  END LOOP;
END $$;
