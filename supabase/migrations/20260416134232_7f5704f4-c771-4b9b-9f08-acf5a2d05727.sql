
-- Prescription Rules
CREATE TABLE public.prescription_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  disease TEXT,
  symptoms TEXT,
  age_min INTEGER DEFAULT 0,
  age_max INTEGER DEFAULT 120,
  dosage TEXT,
  instructions TEXT,
  timing_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.prescription_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage prescription rules" ON public.prescription_rules FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Anyone can view prescription rules" ON public.prescription_rules FOR SELECT USING (true);

-- Order Prescriptions
CREATE TABLE public.order_prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_age INTEGER,
  doctor_name TEXT,
  prescription_image TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.order_prescriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage order prescriptions" ON public.order_prescriptions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Tally Vouchers
CREATE TABLE public.tally_vouchers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  party_name TEXT,
  voucher_type TEXT,
  voucher_date DATE,
  voucher_number TEXT,
  total_amount NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  amount_due NUMERIC DEFAULT 0,
  items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tally_vouchers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage tally vouchers" ON public.tally_vouchers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
