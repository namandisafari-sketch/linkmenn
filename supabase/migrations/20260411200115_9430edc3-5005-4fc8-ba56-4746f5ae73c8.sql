
CREATE TABLE public.prescription_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  disease TEXT NOT NULL,
  symptoms TEXT,
  age_min INTEGER DEFAULT 0,
  age_max INTEGER DEFAULT 120,
  dosage TEXT NOT NULL,
  instructions TEXT,
  timing_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.prescription_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage prescription rules"
ON public.prescription_rules FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view prescription rules"
ON public.prescription_rules FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'staff'));

CREATE TRIGGER update_prescription_rules_updated_at
BEFORE UPDATE ON public.prescription_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
