
CREATE TABLE public.tally_vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_number TEXT NOT NULL,
  voucher_type TEXT NOT NULL DEFAULT 'Purchase',
  voucher_date DATE NOT NULL,
  party_name TEXT,
  reference TEXT,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  address TEXT,
  year INTEGER NOT NULL,
  guid TEXT UNIQUE,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tally_vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage tally vouchers"
ON public.tally_vouchers FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can view tally vouchers"
ON public.tally_vouchers FOR SELECT TO authenticated
USING (true);

CREATE INDEX idx_tally_vouchers_year ON public.tally_vouchers(year);
CREATE INDEX idx_tally_vouchers_party ON public.tally_vouchers(party_name);
CREATE INDEX idx_tally_vouchers_date ON public.tally_vouchers(voucher_date);
