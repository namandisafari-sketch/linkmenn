
-- Fix order_items INSERT policy to check ownership
DROP POLICY IF EXISTS "Users can insert order items" ON public.order_items;
CREATE POLICY "Users can insert order items" ON public.order_items 
  FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()));

-- Fix order_prescriptions INSERT policy
DROP POLICY IF EXISTS "Users can insert prescriptions" ON public.order_prescriptions;
CREATE POLICY "Users can insert order prescriptions" ON public.order_prescriptions 
  FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_prescriptions.order_id AND orders.user_id = auth.uid()));

-- Fix storage: restrict uploads to admins
DROP POLICY IF EXISTS "Admins can upload product images" ON storage.objects;
CREATE POLICY "Admins can upload product images" ON storage.objects 
  FOR INSERT WITH CHECK (bucket_id = 'product-images' AND public.has_role(auth.uid(), 'admin'));
