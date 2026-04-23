
-- ============================================================
-- SECTION 1: Pharmacies (multi-tenant root)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pharmacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Marvid Pharmaceutical UG',
  address text,
  phone text,
  vat_number text,
  currency text NOT NULL DEFAULT 'UGX',
  vat_rate numeric(5,2) NOT NULL DEFAULT 18.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pharmacies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view pharmacies" ON public.pharmacies;
CREATE POLICY "Anyone authenticated can view pharmacies"
  ON public.pharmacies FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage pharmacies" ON public.pharmacies;
CREATE POLICY "Admins manage pharmacies"
  ON public.pharmacies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.pharmacies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Marvid Pharmaceutical UG')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 2: Rename products -> medicines
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='products' AND table_type='BASE TABLE') THEN
    ALTER TABLE public.products RENAME TO medicines;
  END IF;
END $$;

ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS reorder_level int DEFAULT 0;
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS vat_applicable boolean DEFAULT true;
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS unit_of_measure text DEFAULT 'piece';
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS generic_name text;
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS brand text;
ALTER TABLE public.medicines ADD COLUMN IF NOT EXISTS barcode text;

CREATE INDEX IF NOT EXISTS idx_medicines_search
  ON public.medicines USING gin (
    to_tsvector('simple', coalesce(name,'') || ' ' || coalesce(generic_name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(barcode,''))
  );

-- ============================================================
-- SECTION 3: Rename product_batches -> medicine_batches
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='product_batches' AND table_type='BASE TABLE') THEN
    ALTER TABLE public.product_batches RENAME TO medicine_batches;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='medicine_batches' AND column_name='product_id') THEN
    ALTER TABLE public.medicine_batches RENAME COLUMN product_id TO medicine_id;
  END IF;
END $$;

ALTER TABLE public.medicine_batches ADD COLUMN IF NOT EXISTS qty_received int;
ALTER TABLE public.medicine_batches ADD COLUMN IF NOT EXISTS qty_remaining int;
ALTER TABLE public.medicine_batches ADD COLUMN IF NOT EXISTS purchase_cost numeric(15,4);
ALTER TABLE public.medicine_batches ADD COLUMN IF NOT EXISTS selling_price numeric(15,4);
ALTER TABLE public.medicine_batches ADD COLUMN IF NOT EXISTS grn_id uuid;
ALTER TABLE public.medicine_batches ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) DEFAULT '00000000-0000-0000-0000-000000000001';

UPDATE public.medicine_batches SET qty_received = COALESCE(quantity, 0) WHERE qty_received IS NULL;
UPDATE public.medicine_batches SET qty_remaining = COALESCE(quantity, 0) WHERE qty_remaining IS NULL;
UPDATE public.medicine_batches SET purchase_cost = COALESCE(purchase_price, 0) WHERE purchase_cost IS NULL;
UPDATE public.medicine_batches SET selling_price = COALESCE(mrp, 0) WHERE selling_price IS NULL;

ALTER TABLE public.medicine_batches ALTER COLUMN qty_received SET DEFAULT 0;
ALTER TABLE public.medicine_batches ALTER COLUMN qty_remaining SET DEFAULT 0;
ALTER TABLE public.medicine_batches ALTER COLUMN qty_received SET NOT NULL;
ALTER TABLE public.medicine_batches ALTER COLUMN qty_remaining SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.medicine_batches ADD CONSTRAINT batch_qty_remaining_nonneg CHECK (qty_remaining >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.medicine_batches ADD CONSTRAINT batch_qty_remaining_lte_received CHECK (qty_remaining <= qty_received);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_batches_fefo
  ON public.medicine_batches (medicine_id, expiry_date)
  WHERE qty_remaining > 0;

-- ============================================================
-- SECTION 4: Account Groups + Chart of Accounts
-- ============================================================
CREATE TABLE IF NOT EXISTS public.account_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  nature text NOT NULL CHECK (nature IN ('debit','credit')),
  parent_group_id uuid REFERENCES public.account_groups(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view account groups" ON public.account_groups;
CREATE POLICY "Authenticated view account groups"
  ON public.account_groups FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage account groups" ON public.account_groups;
CREATE POLICY "Admins manage account groups"
  ON public.account_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.account_groups (id, name, nature) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Assets', 'debit'),
  ('10000000-0000-0000-0000-000000000002', 'Liabilities', 'credit'),
  ('10000000-0000-0000-0000-000000000003', 'Income', 'credit'),
  ('10000000-0000-0000-0000-000000000004', 'Expenses', 'debit'),
  ('10000000-0000-0000-0000-000000000005', 'Capital', 'credit')
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  name text NOT NULL,
  group_id uuid REFERENCES public.account_groups(id),
  is_system boolean NOT NULL DEFAULT false,
  pharmacy_id uuid REFERENCES public.pharmacies(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  opening_balance numeric(15,4) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pharmacy_id, code)
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated view accounts" ON public.accounts;
CREATE POLICY "Authenticated view accounts"
  ON public.accounts FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage accounts" ON public.accounts;
CREATE POLICY "Admins manage accounts"
  ON public.accounts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.accounts (code, name, group_id, is_system, pharmacy_id) VALUES
  ('1001', 'Cash on Hand',         '10000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000001'),
  ('1002', 'Bank Account',         '10000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000001'),
  ('1003', 'Stock / Inventory',    '10000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000001'),
  ('1004', 'Accounts Receivable',  '10000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000001'),
  ('2001', 'Accounts Payable',     '10000000-0000-0000-0000-000000000002', true, '00000000-0000-0000-0000-000000000001'),
  ('2002', 'VAT Payable',          '10000000-0000-0000-0000-000000000002', true, '00000000-0000-0000-0000-000000000001'),
  ('4001', 'Sales Revenue',        '10000000-0000-0000-0000-000000000003', true, '00000000-0000-0000-0000-000000000001'),
  ('4002', 'Other Income',         '10000000-0000-0000-0000-000000000003', true, '00000000-0000-0000-0000-000000000001'),
  ('5001', 'Cost of Goods Sold',   '10000000-0000-0000-0000-000000000004', true, '00000000-0000-0000-0000-000000000001'),
  ('5002', 'Purchase Returns',     '10000000-0000-0000-0000-000000000004', true, '00000000-0000-0000-0000-000000000001'),
  ('5003', 'Operating Expenses',   '10000000-0000-0000-0000-000000000004', true, '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SECTION 5: Rename vouchers -> journals, general_ledger -> journal_lines
-- ============================================================
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='vouchers' AND table_type='BASE TABLE') THEN
    ALTER TABLE public.vouchers RENAME TO journals;
  END IF;
END $$;

ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) DEFAULT '00000000-0000-0000-0000-000000000001';
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS posted_by uuid REFERENCES auth.users(id);
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS is_cancelled boolean NOT NULL DEFAULT false;
ALTER TABLE public.journals ADD COLUMN IF NOT EXISTS reference text;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='general_ledger' AND table_type='BASE TABLE') THEN
    ALTER TABLE public.general_ledger RENAME TO journal_lines;
  END IF;
END $$;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='journal_lines' AND column_name='voucher_id') THEN
    ALTER TABLE public.journal_lines RENAME COLUMN voucher_id TO journal_id;
  END IF;
END $$;

ALTER TABLE public.journal_lines ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id);

ALTER TABLE public.journal_lines ALTER COLUMN debit TYPE numeric(15,4);
ALTER TABLE public.journal_lines ALTER COLUMN credit TYPE numeric(15,4);
ALTER TABLE public.journal_lines ALTER COLUMN debit SET DEFAULT 0;
ALTER TABLE public.journal_lines ALTER COLUMN credit SET DEFAULT 0;

UPDATE public.journal_lines SET debit = 0 WHERE debit IS NULL;
UPDATE public.journal_lines SET credit = 0 WHERE credit IS NULL;
ALTER TABLE public.journal_lines ALTER COLUMN debit SET NOT NULL;
ALTER TABLE public.journal_lines ALTER COLUMN credit SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.journal_lines ADD CONSTRAINT jl_nonneg CHECK (debit >= 0 AND credit >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.journal_lines ADD CONSTRAINT jl_one_side CHECK (debit = 0 OR credit = 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.journal_lines ADD CONSTRAINT jl_nonzero CHECK (debit > 0 OR credit > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_journal_lines_journal ON public.journal_lines(journal_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journals_date ON public.journals(voucher_date);
CREATE INDEX IF NOT EXISTS idx_journals_type ON public.journals(voucher_type);

-- ============================================================
-- SECTION 6: Voucher number sequence
-- ============================================================
CREATE TABLE IF NOT EXISTS public.voucher_sequences (
  voucher_type text PRIMARY KEY,
  prefix text NOT NULL,
  next_number int NOT NULL DEFAULT 1
);

INSERT INTO public.voucher_sequences (voucher_type, prefix, next_number) VALUES
  ('sale', 'SL', 1),
  ('purchase', 'PU', 1),
  ('payment', 'PY', 1),
  ('receipt', 'RC', 1),
  ('journal', 'JV', 1),
  ('credit_note', 'CN', 1),
  ('debit_note', 'DN', 1),
  ('contra', 'CT', 1)
ON CONFLICT DO NOTHING;

ALTER TABLE public.voucher_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated view sequences" ON public.voucher_sequences;
CREATE POLICY "Authenticated view sequences" ON public.voucher_sequences FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.next_voucher_number(p_voucher_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_num int;
BEGIN
  UPDATE public.voucher_sequences
    SET next_number = next_number + 1
    WHERE voucher_type = p_voucher_type
    RETURNING prefix, next_number - 1 INTO v_prefix, v_num;
  RETURN v_prefix || '-' || lpad(v_num::text, 6, '0');
END;
$$;

-- ============================================================
-- SECTION 7: Double-entry balance trigger
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_journal_balance()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_debit numeric(15,4);
  v_credit numeric(15,4);
  v_journal uuid;
BEGIN
  v_journal := COALESCE(NEW.journal_id, OLD.journal_id);
  SELECT COALESCE(SUM(debit),0), COALESCE(SUM(credit),0)
    INTO v_debit, v_credit
    FROM public.journal_lines WHERE journal_id = v_journal;
  IF v_debit <> v_credit THEN
    RAISE EXCEPTION 'Journal % is unbalanced: debit=% credit=%', v_journal, v_debit, v_credit;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_journal_balance ON public.journal_lines;
CREATE CONSTRAINT TRIGGER trg_validate_journal_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.validate_journal_balance();

-- ============================================================
-- SECTION 8: FEFO stock deduction
-- ============================================================
CREATE OR REPLACE FUNCTION public.deduct_fefo_stock(p_medicine_id uuid, p_qty_needed int)
RETURNS TABLE(batch_id uuid, qty_deducted int, unit_cost numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining int := p_qty_needed;
  v_total int;
  r RECORD;
  v_take int;
BEGIN
  SELECT COALESCE(SUM(qty_remaining),0) INTO v_total
    FROM public.medicine_batches
    WHERE medicine_id = p_medicine_id AND qty_remaining > 0;
  IF v_total < p_qty_needed THEN
    RAISE EXCEPTION 'Insufficient stock for medicine %: needed %, have %', p_medicine_id, p_qty_needed, v_total;
  END IF;

  FOR r IN
    SELECT id, qty_remaining, COALESCE(purchase_cost, 0) AS cost
      FROM public.medicine_batches
      WHERE medicine_id = p_medicine_id AND qty_remaining > 0
      ORDER BY expiry_date ASC NULLS LAST, created_at ASC
      FOR UPDATE
  LOOP
    EXIT WHEN v_remaining <= 0;
    v_take := LEAST(r.qty_remaining, v_remaining);
    UPDATE public.medicine_batches SET qty_remaining = qty_remaining - v_take WHERE id = r.id;
    BEGIN
      UPDATE public.medicine_batches SET quantity = GREATEST(0, COALESCE(quantity,0) - v_take) WHERE id = r.id;
    EXCEPTION WHEN undefined_column THEN NULL; END;
    batch_id := r.id;
    qty_deducted := v_take;
    unit_cost := r.cost;
    RETURN NEXT;
    v_remaining := v_remaining - v_take;
  END LOOP;

  UPDATE public.medicines
    SET stock = (SELECT COALESCE(SUM(qty_remaining),0) FROM public.medicine_batches WHERE medicine_id = p_medicine_id)
    WHERE id = p_medicine_id;
END;
$$;

-- ============================================================
-- SECTION 9: post_sale_voucher
-- ============================================================
CREATE OR REPLACE FUNCTION public.post_sale_voucher(
  p_sale_lines jsonb,
  p_customer_id uuid,
  p_payment_method text,
  p_pharmacy_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_id uuid;
  v_voucher_no text;
  v_subtotal numeric(15,4) := 0;
  v_vat_total numeric(15,4) := 0;
  v_cogs_total numeric(15,4) := 0;
  v_grand numeric(15,4);
  v_vat_rate numeric(5,2);
  v_acc_cash uuid;
  v_acc_ar uuid;
  v_acc_sales uuid;
  v_acc_vat uuid;
  v_acc_cogs uuid;
  v_acc_stock uuid;
  v_debit_account uuid;
  line jsonb;
  v_med_id uuid;
  v_qty int;
  v_rate numeric(15,4);
  v_disc numeric(15,4);
  v_line_net numeric(15,4);
  v_line_vat numeric(15,4);
  v_vat_appl boolean;
  fefo RECORD;
BEGIN
  SELECT vat_rate INTO v_vat_rate FROM public.pharmacies WHERE id = p_pharmacy_id;
  IF v_vat_rate IS NULL THEN v_vat_rate := 18.00; END IF;

  SELECT id INTO v_acc_cash  FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '1001';
  SELECT id INTO v_acc_ar    FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '1004';
  SELECT id INTO v_acc_sales FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '4001';
  SELECT id INTO v_acc_vat   FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '2002';
  SELECT id INTO v_acc_cogs  FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '5001';
  SELECT id INTO v_acc_stock FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '1003';

  v_voucher_no := public.next_voucher_number('sale');

  INSERT INTO public.journals (voucher_type, voucher_number, voucher_date, party_name, posted_by, pharmacy_id, status)
  VALUES ('sale', v_voucher_no, CURRENT_DATE,
          (SELECT customer_name FROM public.customer_credits WHERE id = p_customer_id),
          auth.uid(), p_pharmacy_id, 'posted')
  RETURNING id INTO v_journal_id;

  FOR line IN SELECT * FROM jsonb_array_elements(p_sale_lines) LOOP
    v_med_id := (line->>'medicine_id')::uuid;
    v_qty := (line->>'qty')::int;
    v_rate := (line->>'rate')::numeric;
    v_disc := COALESCE((line->>'discount')::numeric, 0);
    SELECT vat_applicable INTO v_vat_appl FROM public.medicines WHERE id = v_med_id;

    v_line_net := (v_qty * v_rate) - v_disc;
    v_line_vat := CASE WHEN COALESCE(v_vat_appl,true) THEN v_line_net * v_vat_rate / 100 ELSE 0 END;
    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;

    FOR fefo IN SELECT * FROM public.deduct_fefo_stock(v_med_id, v_qty) LOOP
      v_cogs_total := v_cogs_total + (fefo.qty_deducted * fefo.unit_cost);
    END LOOP;
  END LOOP;

  v_grand := v_subtotal + v_vat_total;
  v_debit_account := CASE WHEN p_payment_method = 'credit' THEN v_acc_ar ELSE v_acc_cash END;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit) VALUES
    (v_journal_id, v_debit_account, v_grand, 0),
    (v_journal_id, v_acc_sales, 0, v_subtotal);
  IF v_vat_total > 0 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit) VALUES
      (v_journal_id, v_acc_vat, 0, v_vat_total);
  END IF;

  IF v_cogs_total > 0 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, debit, credit) VALUES
      (v_journal_id, v_acc_cogs, v_cogs_total, 0),
      (v_journal_id, v_acc_stock, 0, v_cogs_total);
  END IF;

  UPDATE public.journals SET total_amount = v_grand WHERE id = v_journal_id;
  RETURN v_journal_id;
END;
$$;

-- ============================================================
-- SECTION 10: GRN tables
-- ============================================================
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS po_number text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS expected_delivery_date date;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS pharmacy_id uuid REFERENCES public.pharmacies(id) DEFAULT '00000000-0000-0000-0000-000000000001';

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='purchase_order_items' AND column_name='quantity') THEN
    ALTER TABLE public.purchase_order_items RENAME COLUMN quantity TO qty_ordered;
  END IF;
END $$;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS qty_received int DEFAULT 0;
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS rate numeric(15,4);
UPDATE public.purchase_order_items SET rate = unit_price WHERE rate IS NULL;

CREATE TABLE IF NOT EXISTS public.goods_received_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_number text NOT NULL,
  po_id uuid REFERENCES public.purchase_orders(id),
  supplier_id uuid REFERENCES public.suppliers(id),
  supplier_name text,
  grn_date date NOT NULL DEFAULT CURRENT_DATE,
  invoice_reference text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted')),
  total_amount numeric(15,4) NOT NULL DEFAULT 0,
  pharmacy_id uuid REFERENCES public.pharmacies(id) DEFAULT '00000000-0000-0000-0000-000000000001',
  created_by uuid REFERENCES auth.users(id),
  journal_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.goods_received_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth view GRNs" ON public.goods_received_notes;
CREATE POLICY "Auth view GRNs" ON public.goods_received_notes FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'));
DROP POLICY IF EXISTS "Mgr admin manage GRNs" ON public.goods_received_notes;
CREATE POLICY "Mgr admin manage GRNs" ON public.goods_received_notes FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE TABLE IF NOT EXISTS public.grn_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grn_id uuid NOT NULL REFERENCES public.goods_received_notes(id) ON DELETE CASCADE,
  medicine_id uuid REFERENCES public.medicines(id),
  batch_number text,
  manufacture_date date,
  expiry_date date NOT NULL,
  qty_received int NOT NULL,
  rate numeric(15,4) NOT NULL DEFAULT 0,
  total numeric(15,4) GENERATED ALWAYS AS (qty_received * rate) STORED,
  batch_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.grn_lines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth view GRN lines" ON public.grn_lines;
CREATE POLICY "Auth view GRN lines" ON public.grn_lines FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Mgr admin manage GRN lines" ON public.grn_lines;
CREATE POLICY "Mgr admin manage GRN lines" ON public.grn_lines FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager'));

CREATE OR REPLACE FUNCTION public.post_grn(p_grn_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_grn RECORD;
  v_journal_id uuid;
  v_voucher_no text;
  v_acc_stock uuid;
  v_acc_payable uuid;
  v_total numeric(15,4) := 0;
  r RECORD;
  v_batch_id uuid;
BEGIN
  SELECT * INTO v_grn FROM public.goods_received_notes WHERE id = p_grn_id;
  IF v_grn.status = 'posted' THEN
    RAISE EXCEPTION 'GRN already posted';
  END IF;

  SELECT id INTO v_acc_stock   FROM public.accounts WHERE pharmacy_id = v_grn.pharmacy_id AND code = '1003';
  SELECT id INTO v_acc_payable FROM public.accounts WHERE pharmacy_id = v_grn.pharmacy_id AND code = '2001';

  v_voucher_no := public.next_voucher_number('purchase');
  INSERT INTO public.journals (voucher_type, voucher_number, voucher_date, party_name, posted_by, pharmacy_id, status, reference)
    VALUES ('purchase', v_voucher_no, v_grn.grn_date, v_grn.supplier_name, auth.uid(), v_grn.pharmacy_id, 'posted', v_grn.invoice_reference)
    RETURNING id INTO v_journal_id;

  FOR r IN SELECT * FROM public.grn_lines WHERE grn_id = p_grn_id LOOP
    INSERT INTO public.medicine_batches (medicine_id, batch_number, mfg_date, expiry_date, qty_received, qty_remaining, purchase_cost, mrp, grn_id, pharmacy_id)
      VALUES (r.medicine_id, r.batch_number, r.manufacture_date, r.expiry_date, r.qty_received, r.qty_received, r.rate, r.rate, p_grn_id, v_grn.pharmacy_id)
      RETURNING id INTO v_batch_id;
    UPDATE public.grn_lines SET batch_id = v_batch_id WHERE id = r.id;
    UPDATE public.medicines
      SET stock = (SELECT COALESCE(SUM(qty_remaining),0) FROM public.medicine_batches WHERE medicine_id = r.medicine_id)
      WHERE id = r.medicine_id;
    v_total := v_total + (r.qty_received * r.rate);
  END LOOP;

  INSERT INTO public.journal_lines (journal_id, account_id, debit, credit) VALUES
    (v_journal_id, v_acc_stock, v_total, 0),
    (v_journal_id, v_acc_payable, 0, v_total);

  UPDATE public.journals SET total_amount = v_total WHERE id = v_journal_id;
  UPDATE public.goods_received_notes SET status = 'posted', total_amount = v_total, journal_id = v_journal_id, updated_at = now() WHERE id = p_grn_id;
  RETURN v_journal_id;
END;
$$;

-- ============================================================
-- SECTION 11: Audit Log (append-only)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_log (
  id bigserial PRIMARY KEY,
  table_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
  record_id uuid,
  changed_by uuid REFERENCES auth.users(id),
  old_data jsonb,
  new_data jsonb,
  ip_address text,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_table ON public.audit_log(table_name, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON public.audit_log(changed_by);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated insert audit" ON public.audit_log;
CREATE POLICY "Authenticated insert audit"
  ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "Admin view audit" ON public.audit_log;
CREATE POLICY "Admin view audit"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.audit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record_id uuid;
BEGIN
  BEGIN
    v_record_id := COALESCE((to_jsonb(NEW)->>'id')::uuid, (to_jsonb(OLD)->>'id')::uuid);
  EXCEPTION WHEN OTHERS THEN v_record_id := NULL; END;
  INSERT INTO public.audit_log (table_name, action, record_id, changed_by, old_data, new_data)
  VALUES (
    TG_TABLE_NAME, TG_OP, v_record_id, auth.uid(),
    CASE WHEN TG_OP IN ('UPDATE','DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT','UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_journals ON public.journals;
CREATE TRIGGER trg_audit_journals AFTER INSERT OR UPDATE OR DELETE ON public.journals
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_journal_lines ON public.journal_lines;
CREATE TRIGGER trg_audit_journal_lines AFTER INSERT OR UPDATE OR DELETE ON public.journal_lines
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_medicine_batches ON public.medicine_batches;
CREATE TRIGGER trg_audit_medicine_batches AFTER INSERT OR UPDATE OR DELETE ON public.medicine_batches
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_medicines ON public.medicines;
CREATE TRIGGER trg_audit_medicines AFTER INSERT OR UPDATE OR DELETE ON public.medicines
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_purchase_orders ON public.purchase_orders;
CREATE TRIGGER trg_audit_purchase_orders AFTER INSERT OR UPDATE OR DELETE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

DROP TRIGGER IF EXISTS trg_audit_grn ON public.goods_received_notes;
CREATE TRIGGER trg_audit_grn AFTER INSERT OR UPDATE OR DELETE ON public.goods_received_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_trigger();

-- ============================================================
-- SECTION 12: Tighten money types
-- ============================================================
ALTER TABLE public.journals ALTER COLUMN total_amount TYPE numeric(15,4);
ALTER TABLE public.medicines ALTER COLUMN price TYPE numeric(15,4);
ALTER TABLE public.medicines ALTER COLUMN buying_price TYPE numeric(15,4);
ALTER TABLE public.medicines ALTER COLUMN wholesale_price TYPE numeric(15,4);
ALTER TABLE public.orders ALTER COLUMN total TYPE numeric(15,4);

-- ============================================================
-- SECTION 13: Compatibility views (legacy code keeps working)
-- ============================================================
CREATE OR REPLACE VIEW public.products AS SELECT * FROM public.medicines;
CREATE OR REPLACE VIEW public.product_batches AS SELECT * FROM public.medicine_batches;
CREATE OR REPLACE VIEW public.vouchers AS SELECT * FROM public.journals;
CREATE OR REPLACE VIEW public.general_ledger AS SELECT * FROM public.journal_lines;
