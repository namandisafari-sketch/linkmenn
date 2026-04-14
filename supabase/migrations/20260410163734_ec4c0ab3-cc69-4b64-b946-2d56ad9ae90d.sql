
-- Create customer credits table
CREATE TABLE public.customer_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_phone TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL,
  credit_balance NUMERIC NOT NULL DEFAULT 0,
  total_spent NUMERIC NOT NULL DEFAULT 0,
  total_paid NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage customer credits"
ON public.customer_credits
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view customer credits"
ON public.customer_credits
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'staff'));

CREATE TRIGGER update_customer_credits_updated_at
BEFORE UPDATE ON public.customer_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
