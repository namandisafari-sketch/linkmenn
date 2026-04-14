
-- Store prescription rules applied to each order
CREATE TABLE public.order_prescriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  disease TEXT NOT NULL,
  symptoms TEXT,
  dosage TEXT NOT NULL,
  instructions TEXT,
  timing_notes TEXT,
  age_range TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage order prescriptions"
  ON public.order_prescriptions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view order prescriptions"
  ON public.order_prescriptions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'staff'));

CREATE POLICY "Users can view own order prescriptions"
  ON public.order_prescriptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.orders WHERE orders.id = order_prescriptions.order_id AND orders.user_id = auth.uid()
  ));

CREATE INDEX idx_order_prescriptions_order_id ON public.order_prescriptions(order_id);
