
-- Product Batches table for FEFO tracking
CREATE TABLE public.product_batches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  batch_number TEXT,
  expiry_date DATE NOT NULL,
  mfg_date DATE,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  mrp NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage batches" ON public.product_batches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view batches" ON public.product_batches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE INDEX idx_batches_product ON public.product_batches(product_id);
CREATE INDEX idx_batches_expiry ON public.product_batches(expiry_date);

-- Vouchers table (Sales, Purchases, Receipts, Payments)
CREATE TABLE public.vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_number TEXT NOT NULL UNIQUE,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('sales', 'purchase', 'receipt', 'payment', 'journal')),
  voucher_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  party_name TEXT,
  party_phone TEXT,
  narration TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  reference_id UUID,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage vouchers" ON public.vouchers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view vouchers" ON public.vouchers FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

-- Voucher Items
CREATE TABLE public.voucher_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  batch_id UUID REFERENCES public.product_batches(id),
  description TEXT,
  quantity NUMERIC NOT NULL DEFAULT 1,
  rate NUMERIC NOT NULL DEFAULT 0,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.voucher_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage voucher items" ON public.voucher_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view voucher items" ON public.voucher_items FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

-- General Ledger (double-entry)
CREATE TABLE public.general_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  debit NUMERIC NOT NULL DEFAULT 0,
  credit NUMERIC NOT NULL DEFAULT 0,
  narration TEXT,
  entry_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.general_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage ledger" ON public.general_ledger FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view ledger" ON public.general_ledger FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE INDEX idx_ledger_voucher ON public.general_ledger(voucher_id);
CREATE INDEX idx_ledger_account ON public.general_ledger(account_name);
CREATE INDEX idx_ledger_date ON public.general_ledger(entry_date);

-- Purchase Invoices for bill-by-bill settlement
CREATE TABLE public.purchase_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_id UUID NOT NULL REFERENCES public.vouchers(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  invoice_number TEXT,
  invoice_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  total_amount NUMERIC NOT NULL DEFAULT 0,
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  amount_due NUMERIC GENERATED ALWAYS AS (total_amount - amount_paid) STORED,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'partial', 'paid')),
  due_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage purchase invoices" ON public.purchase_invoices FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff can view purchase invoices" ON public.purchase_invoices FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

-- Triggers for updated_at
CREATE TRIGGER update_product_batches_updated_at BEFORE UPDATE ON public.product_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_vouchers_updated_at BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_purchase_invoices_updated_at BEFORE UPDATE ON public.purchase_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
