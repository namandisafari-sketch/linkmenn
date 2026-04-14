
CREATE TABLE public.credit_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_credit_id UUID NOT NULL REFERENCES public.customer_credits(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('purchase', 'payment')),
  amount NUMERIC NOT NULL DEFAULT 0,
  description TEXT,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage credit transactions"
ON public.credit_transactions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Staff can view credit transactions"
ON public.credit_transactions
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'staff'::app_role));

CREATE INDEX idx_credit_transactions_customer ON public.credit_transactions(customer_credit_id);
CREATE INDEX idx_credit_transactions_created ON public.credit_transactions(created_at);
