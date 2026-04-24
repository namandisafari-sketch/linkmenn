
-- ============================================================
-- 1. COMPANIES + MEMBERSHIP
-- ============================================================
CREATE TABLE IF NOT EXISTS public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  legal_name text,
  tax_id text,
  currency text NOT NULL DEFAULT 'UGX',
  address text,
  phone text,
  email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

INSERT INTO public.companies (id, name, legal_name, currency)
VALUES ('00000000-0000-0000-0000-000000000001', 'Marvid Pharmaceutical UG', 'Marvid Pharmaceutical Uganda Ltd', 'UGX')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.user_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);

ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Helper: is user a member of this company?
CREATE OR REPLACE FUNCTION public.is_company_member(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = _user_id AND company_id = _company_id
  ) OR _company_id = '00000000-0000-0000-0000-000000000001'::uuid;
$$;

-- Helper: get user's primary company
CREATE OR REPLACE FUNCTION public.get_user_company(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT company_id FROM public.user_companies WHERE user_id = _user_id ORDER BY created_at LIMIT 1),
    '00000000-0000-0000-0000-000000000001'::uuid
  );
$$;

CREATE POLICY "Users view own memberships" ON public.user_companies
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage memberships" ON public.user_companies
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members view their company" ON public.companies
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), id));
CREATE POLICY "Admins manage companies" ON public.companies
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Auto-add new users to default company
CREATE OR REPLACE FUNCTION public.handle_new_user_company()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_companies (user_id, company_id, role)
  VALUES (NEW.id, '00000000-0000-0000-0000-000000000001'::uuid, 'member')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created_company ON auth.users;
CREATE TRIGGER on_auth_user_created_company
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_company();

-- Backfill existing users
INSERT INTO public.user_companies (user_id, company_id, role)
SELECT id, '00000000-0000-0000-0000-000000000001'::uuid, 'member' FROM auth.users
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2. ADD company_id TO EXISTING TABLES
-- ============================================================
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accounts','journals','journal_lines','medicines','medicine_batches',
    'goods_received_notes','grn_lines','suppliers','customer_credits',
    'orders','order_items','purchase_orders','purchase_order_items','pharmacies'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS company_id uuid DEFAULT %L::uuid REFERENCES public.companies(id)',
      t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('UPDATE public.%I SET company_id = %L WHERE company_id IS NULL', t, '00000000-0000-0000-0000-000000000001');
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I(company_id)', 'idx_'||t||'_company', t);
  END LOOP;
END $$;

-- ============================================================
-- 3. PARTIES (unified customers/suppliers)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id),
  name text NOT NULL,
  party_type text NOT NULL DEFAULT 'customer' CHECK (party_type IN ('customer','supplier','both')),
  phone text, email text, address text, tax_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view parties" ON public.parties FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members manage parties" ON public.parties FOR ALL TO authenticated USING (public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- ============================================================
-- 4. FISCAL YEARS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.fiscal_years (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  is_closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_date > start_date)
);
ALTER TABLE public.fiscal_years ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view fiscal years" ON public.fiscal_years FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins manage fiscal years" ON public.fiscal_years FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.fiscal_years (company_id, name, start_date, end_date, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', 'FY 2025-2026', '2025-07-01', '2026-06-30', true)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 5. TAX RATES
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tax_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id),
  name text NOT NULL,
  rate numeric(6,3) NOT NULL,
  tax_type text NOT NULL CHECK (tax_type IN ('VAT','WHT','PAYE','NSSF','OTHER')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tax_rates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view tax rates" ON public.tax_rates FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins manage tax rates" ON public.tax_rates FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.tax_rates (company_id, name, rate, tax_type) VALUES
  ('00000000-0000-0000-0000-000000000001','VAT Standard',18.000,'VAT'),
  ('00000000-0000-0000-0000-000000000001','VAT Zero',0.000,'VAT'),
  ('00000000-0000-0000-0000-000000000001','WHT Standard',6.000,'WHT'),
  ('00000000-0000-0000-0000-000000000001','PAYE Top Band',30.000,'PAYE'),
  ('00000000-0000-0000-0000-000000000001','NSSF Employee',5.000,'NSSF'),
  ('00000000-0000-0000-0000-000000000001','NSSF Employer',10.000,'NSSF')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 6. INVENTORY ITEMS (generic, separate from pharmacy medicines)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id),
  code text NOT NULL,
  name text NOT NULL,
  unit text DEFAULT 'pcs',
  cost_price numeric(15,2) NOT NULL DEFAULT 0,
  sale_price numeric(15,2) NOT NULL DEFAULT 0,
  stock_qty numeric(15,3) NOT NULL DEFAULT 0,
  account_id uuid REFERENCES public.accounts(id),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view inventory items" ON public.inventory_items FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Members manage inventory items" ON public.inventory_items FOR ALL TO authenticated USING (public.is_company_member(auth.uid(), company_id)) WITH CHECK (public.is_company_member(auth.uid(), company_id));

-- ============================================================
-- 7. LEDGER ENTRIES (denormalized for reports)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL DEFAULT '00000000-0000-0000-0000-000000000001'::uuid REFERENCES public.companies(id),
  account_id uuid NOT NULL REFERENCES public.accounts(id),
  journal_line_id uuid REFERENCES public.journal_lines(id) ON DELETE CASCADE,
  journal_id uuid REFERENCES public.journals(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  debit numeric(15,2) NOT NULL DEFAULT 0,
  credit numeric(15,2) NOT NULL DEFAULT 0,
  narration text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ledger_account_date ON public.ledger_entries(account_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_company ON public.ledger_entries(company_id);
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view ledger" ON public.ledger_entries FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Admins manage ledger entries" ON public.ledger_entries FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Backfill ledger from existing journal_lines
INSERT INTO public.ledger_entries (account_id, journal_line_id, journal_id, entry_date, debit, credit, narration, company_id)
SELECT jl.account_id, jl.id, jl.journal_id, COALESCE(jl.entry_date, CURRENT_DATE), jl.debit, jl.credit, jl.narration,
       COALESCE(j.company_id, '00000000-0000-0000-0000-000000000001'::uuid)
FROM public.journal_lines jl
LEFT JOIN public.journals j ON j.id = jl.journal_id
WHERE jl.account_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Trigger: keep ledger_entries in sync with journal_lines
CREATE OR REPLACE FUNCTION public.sync_ledger_entry()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_company uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.ledger_entries WHERE journal_line_id = OLD.id;
    RETURN OLD;
  END IF;
  IF NEW.account_id IS NULL THEN RETURN NEW; END IF;
  SELECT COALESCE(company_id, '00000000-0000-0000-0000-000000000001'::uuid) INTO v_company
    FROM public.journals WHERE id = NEW.journal_id;
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ledger_entries (account_id, journal_line_id, journal_id, entry_date, debit, credit, narration, company_id)
    VALUES (NEW.account_id, NEW.id, NEW.journal_id, COALESCE(NEW.entry_date, CURRENT_DATE), NEW.debit, NEW.credit, NEW.narration, v_company);
  ELSE
    UPDATE public.ledger_entries
      SET account_id = NEW.account_id, entry_date = COALESCE(NEW.entry_date, CURRENT_DATE),
          debit = NEW.debit, credit = NEW.credit, narration = NEW.narration, company_id = v_company
      WHERE journal_line_id = NEW.id;
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_sync_ledger ON public.journal_lines;
CREATE TRIGGER trg_sync_ledger
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.sync_ledger_entry();

-- ============================================================
-- 8. STANDARD UGANDA CHART OF ACCOUNTS (codes 1000-9999)
-- ============================================================
INSERT INTO public.accounts (code, name, pharmacy_id, company_id, opening_balance, is_system) VALUES
  -- ASSETS 1000-1999
  ('1001','Cash on Hand','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('1002','Bank - Stanbic','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('1003','Stock / Inventory','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('1004','Accounts Receivable','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('1005','Mobile Money - MTN','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('1006','Mobile Money - Airtel','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('1100','Prepaid Expenses','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('1500','Property & Equipment','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('1510','Accumulated Depreciation','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  -- LIABILITIES 2000-2999
  ('2001','Accounts Payable','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('2002','VAT Payable','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('2003','WHT Payable','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('2004','PAYE Payable','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('2005','NSSF Payable','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('2100','Accrued Expenses','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('2500','Long-Term Loans','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  -- EQUITY 3000-3999
  ('3001','Share Capital','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('3002','Retained Earnings','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('3003','Owner Drawings','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  -- REVENUE 4000-4999
  ('4001','Sales Revenue','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('4002','Service Revenue','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('4003','Other Income','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('4900','Sales Returns & Discounts','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  -- EXPENSES 5000-9999
  ('5001','Cost of Goods Sold','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,true),
  ('6001','Salaries & Wages','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6002','Rent Expense','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6003','Utilities','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6004','Internet & Telephone','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6005','Transport & Fuel','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6006','Office Supplies','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6007','Marketing & Advertising','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6008','Bank Charges','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6009','Professional Fees','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6010','Repairs & Maintenance','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6011','Depreciation Expense','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6012','Insurance','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false),
  ('6099','Miscellaneous Expense','00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000001'::uuid,0,false)
ON CONFLICT DO NOTHING;

-- ============================================================
-- 9. ENFORCE VOUCHER BALANCE TRIGGER (deferred-style check)
-- Only enforces on POSTED journals, after each statement
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_voucher_balance()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_journal uuid;
  v_status text;
  v_debit numeric(15,4);
  v_credit numeric(15,4);
BEGIN
  v_journal := COALESCE(NEW.journal_id, OLD.journal_id);
  IF v_journal IS NULL THEN RETURN NULL; END IF;
  SELECT status INTO v_status FROM public.journals WHERE id = v_journal;
  IF v_status IS DISTINCT FROM 'posted' THEN RETURN NULL; END IF;
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO v_debit, v_credit FROM public.journal_lines WHERE journal_id = v_journal;
  IF ROUND(v_debit,2) <> ROUND(v_credit,2) THEN
    RAISE EXCEPTION 'Voucher % is unbalanced: debits=% credits=%', v_journal, v_debit, v_credit;
  END IF;
  RETURN NULL;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_voucher_balance ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_enforce_voucher_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.enforce_voucher_balance();

-- ============================================================
-- 10. updated_at triggers on new tables
-- ============================================================
DROP TRIGGER IF EXISTS trg_companies_updated ON public.companies;
CREATE TRIGGER trg_companies_updated BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_parties_updated ON public.parties;
CREATE TRIGGER trg_parties_updated BEFORE UPDATE ON public.parties FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_inv_items_updated ON public.inventory_items;
CREATE TRIGGER trg_inv_items_updated BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
