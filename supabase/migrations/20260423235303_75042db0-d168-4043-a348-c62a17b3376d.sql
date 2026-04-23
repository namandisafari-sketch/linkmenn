CREATE OR REPLACE FUNCTION public.post_sale_voucher(p_sale_lines jsonb, p_customer_id uuid, p_payment_method text, p_pharmacy_id uuid DEFAULT '00000000-0000-0000-0000-000000000001'::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_journal_id uuid;
  v_voucher_no text;
  v_subtotal numeric(15,4) := 0;
  v_vat_total numeric(15,4) := 0;
  v_cogs_total numeric(15,4) := 0;
  v_grand numeric(15,4);
  v_vat_rate numeric(5,2);
  v_acc_cash uuid; v_acc_cash_name text;
  v_acc_ar uuid; v_acc_ar_name text;
  v_acc_sales uuid; v_acc_sales_name text;
  v_acc_vat uuid; v_acc_vat_name text;
  v_acc_cogs uuid; v_acc_cogs_name text;
  v_acc_stock uuid; v_acc_stock_name text;
  v_debit_account uuid; v_debit_account_name text;
  line jsonb;
  v_med_id uuid;
  v_qty int;
  v_rate numeric(15,4);
  v_disc numeric(15,4);
  v_line_net numeric(15,4);
  v_line_vat numeric(15,4);
  v_vat_appl boolean;
  fefo RECORD;
BEGIN
  SELECT vat_rate INTO v_vat_rate FROM public.pharmacies WHERE id = p_pharmacy_id;
  IF v_vat_rate IS NULL THEN v_vat_rate := 18.00; END IF;

  SELECT id, name INTO v_acc_cash,  v_acc_cash_name  FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '1001';
  SELECT id, name INTO v_acc_ar,    v_acc_ar_name    FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '1004';
  SELECT id, name INTO v_acc_sales, v_acc_sales_name FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '4001';
  SELECT id, name INTO v_acc_vat,   v_acc_vat_name   FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '2002';
  SELECT id, name INTO v_acc_cogs,  v_acc_cogs_name  FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '5001';
  SELECT id, name INTO v_acc_stock, v_acc_stock_name FROM public.accounts WHERE pharmacy_id = p_pharmacy_id AND code = '1003';

  v_voucher_no := public.next_voucher_number('sale');

  INSERT INTO public.journals (voucher_type, voucher_number, voucher_date, party_name, posted_by, pharmacy_id, status)
  VALUES ('sale', v_voucher_no, CURRENT_DATE,
          (SELECT customer_name FROM public.customer_credits WHERE id = p_customer_id),
          auth.uid(), p_pharmacy_id, 'posted')
  RETURNING id INTO v_journal_id;

  FOR line IN SELECT * FROM jsonb_array_elements(p_sale_lines) LOOP
    v_med_id := (line->>'medicine_id')::uuid;
    v_qty := (line->>'qty')::int;
    v_rate := (line->>'rate')::numeric;
    v_disc := COALESCE((line->>'discount')::numeric, 0);
    SELECT vat_applicable INTO v_vat_appl FROM public.medicines WHERE id = v_med_id;

    v_line_net := (v_qty * v_rate) - v_disc;
    v_line_vat := CASE WHEN COALESCE(v_vat_appl,true) THEN v_line_net * v_vat_rate / 100 ELSE 0 END;
    v_subtotal := v_subtotal + v_line_net;
    v_vat_total := v_vat_total + v_line_vat;

    FOR fefo IN SELECT * FROM public.deduct_fefo_stock(v_med_id, v_qty) LOOP
      v_cogs_total := v_cogs_total + (fefo.qty_deducted * fefo.unit_cost);
    END LOOP;
  END LOOP;

  v_grand := v_subtotal + v_vat_total;
  IF p_payment_method = 'credit' THEN
    v_debit_account := v_acc_ar;   v_debit_account_name := v_acc_ar_name;
  ELSE
    v_debit_account := v_acc_cash; v_debit_account_name := v_acc_cash_name;
  END IF;

  INSERT INTO public.journal_lines (journal_id, account_id, account_name, account_type, debit, credit) VALUES
    (v_journal_id, v_debit_account, COALESCE(v_debit_account_name,'Cash'), 'asset',   v_grand, 0),
    (v_journal_id, v_acc_sales,     COALESCE(v_acc_sales_name,'Sales Revenue'), 'income', 0, v_subtotal);
  IF v_vat_total > 0 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, account_name, account_type, debit, credit) VALUES
      (v_journal_id, v_acc_vat, COALESCE(v_acc_vat_name,'VAT Payable'), 'liability', 0, v_vat_total);
  END IF;

  IF v_cogs_total > 0 THEN
    INSERT INTO public.journal_lines (journal_id, account_id, account_name, account_type, debit, credit) VALUES
      (v_journal_id, v_acc_cogs,  COALESCE(v_acc_cogs_name,'Cost of Goods Sold'), 'expense', v_cogs_total, 0),
      (v_journal_id, v_acc_stock, COALESCE(v_acc_stock_name,'Stock / Inventory'), 'asset',   0, v_cogs_total);
  END IF;

  UPDATE public.journals SET total_amount = v_grand WHERE id = v_journal_id;
  RETURN v_journal_id;
END;
$function$;

-- Same fix for GRN posting
CREATE OR REPLACE FUNCTION public.post_grn(p_grn_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_grn RECORD;
  v_journal_id uuid;
  v_voucher_no text;
  v_acc_stock uuid; v_acc_stock_name text;
  v_acc_payable uuid; v_acc_payable_name text;
  v_total numeric(15,4) := 0;
  r RECORD;
  v_batch_id uuid;
BEGIN
  SELECT * INTO v_grn FROM public.goods_received_notes WHERE id = p_grn_id;
  IF v_grn.status = 'posted' THEN
    RAISE EXCEPTION 'GRN already posted';
  END IF;

  SELECT id, name INTO v_acc_stock,   v_acc_stock_name   FROM public.accounts WHERE pharmacy_id = v_grn.pharmacy_id AND code = '1003';
  SELECT id, name INTO v_acc_payable, v_acc_payable_name FROM public.accounts WHERE pharmacy_id = v_grn.pharmacy_id AND code = '2001';

  v_voucher_no := public.next_voucher_number('purchase');
  INSERT INTO public.journals (voucher_type, voucher_number, voucher_date, party_name, posted_by, pharmacy_id, status, reference)
    VALUES ('purchase', v_voucher_no, v_grn.grn_date, v_grn.supplier_name, auth.uid(), v_grn.pharmacy_id, 'posted', v_grn.invoice_reference)
    RETURNING id INTO v_journal_id;

  FOR r IN SELECT * FROM public.grn_lines WHERE grn_id = p_grn_id LOOP
    INSERT INTO public.medicine_batches (medicine_id, batch_number, mfg_date, expiry_date, qty_received, qty_remaining, purchase_cost, mrp, grn_id, pharmacy_id)
      VALUES (r.medicine_id, r.batch_number, r.manufacture_date, r.expiry_date, r.qty_received, r.qty_received, r.rate, r.rate, p_grn_id, v_grn.pharmacy_id)
      RETURNING id INTO v_batch_id;
    UPDATE public.grn_lines SET batch_id = v_batch_id WHERE id = r.id;
    UPDATE public.medicines
      SET stock = (SELECT COALESCE(SUM(qty_remaining),0) FROM public.medicine_batches WHERE medicine_id = r.medicine_id)
      WHERE id = r.medicine_id;
    v_total := v_total + (r.qty_received * r.rate);
  END LOOP;

  INSERT INTO public.journal_lines (journal_id, account_id, account_name, account_type, debit, credit) VALUES
    (v_journal_id, v_acc_stock,   COALESCE(v_acc_stock_name,'Stock / Inventory'), 'asset',     v_total, 0),
    (v_journal_id, v_acc_payable, COALESCE(v_acc_payable_name,'Accounts Payable'), 'liability', 0, v_total);

  UPDATE public.journals SET total_amount = v_total WHERE id = v_journal_id;
  UPDATE public.goods_received_notes SET status = 'posted', total_amount = v_total, journal_id = v_journal_id, updated_at = now() WHERE id = p_grn_id;
  RETURN v_journal_id;
END;
$function$;