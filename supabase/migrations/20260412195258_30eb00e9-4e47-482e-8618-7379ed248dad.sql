ALTER TABLE public.products 
  ADD COLUMN buying_price numeric DEFAULT 0,
  ADD COLUMN pieces_per_unit integer DEFAULT 1,
  ADD COLUMN unit_description text;