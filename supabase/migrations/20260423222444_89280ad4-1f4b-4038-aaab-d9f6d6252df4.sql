
DROP VIEW IF EXISTS public.products;
DROP VIEW IF EXISTS public.product_batches;
DROP VIEW IF EXISTS public.vouchers;
DROP VIEW IF EXISTS public.general_ledger;

-- Tighten the overly broad GRN lines view policy
DROP POLICY IF EXISTS "Auth view GRN lines" ON public.grn_lines;
CREATE POLICY "Staff view GRN lines" ON public.grn_lines FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'cashier'));
