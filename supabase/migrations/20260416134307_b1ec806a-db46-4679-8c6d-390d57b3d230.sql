
-- Add missing columns to tally_vouchers
ALTER TABLE public.tally_vouchers ADD COLUMN year INTEGER;
ALTER TABLE public.tally_vouchers ADD COLUMN reference TEXT;

-- Voucher Items
CREATE TABLE public.voucher_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID REFERENCES public.vouchers(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.voucher_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage voucher items" ON public.voucher_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Purchase Orders
CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  supplier_name TEXT,
  order_date DATE DEFAULT CURRENT_DATE,
  total_amount NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  amount_due NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'pending',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage purchase orders" ON public.purchase_orders FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Purchase Order Items
CREATE TABLE public.purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES public.purchase_orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  amount NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage purchase order items" ON public.purchase_order_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
