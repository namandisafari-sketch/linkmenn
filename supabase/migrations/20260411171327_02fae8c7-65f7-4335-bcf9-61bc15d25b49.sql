
-- Add wholesale pricing to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_price numeric DEFAULT 0;

-- Add customer type to customer_credits
ALTER TABLE public.customer_credits ADD COLUMN IF NOT EXISTS customer_type text DEFAULT 'retail';

-- Add sale_date for backdated sales support
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS sale_date timestamp with time zone DEFAULT now();

-- Add custom unit price for negotiated/bargained prices
ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS custom_unit_price numeric DEFAULT NULL;

-- Add customer analytics fields
ALTER TABLE public.customer_credits ADD COLUMN IF NOT EXISTS total_purchases integer DEFAULT 0;
ALTER TABLE public.customer_credits ADD COLUMN IF NOT EXISTS last_purchase_date timestamp with time zone DEFAULT NULL;
