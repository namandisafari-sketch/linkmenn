import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * n8n Webhook Endpoint
 * 
 * This function acts as a bridge between n8n workflows and the Marvid system.
 * 
 * Supported actions:
 * - whatsapp_incoming: Process incoming WhatsApp messages via n8n
 * - create_receipt: Create a receipt/order programmatically
 * - check_stock: Query product stock levels
 * - get_customer: Look up customer info
 * - update_stock: Update product stock
 * - send_notification: Store a notification for the admin
 * 
 * n8n Setup:
 * 1. Create a new workflow in n8n
 * 2. Add a "Webhook" trigger node → set to POST
 * 3. Connect to this endpoint: {SUPABASE_URL}/functions/v1/n8n-webhook
 * 4. Add header: Authorization: Bearer {ANON_KEY}
 * 5. Send JSON body with { action, data }
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action, data } = body;

    if (!action) {
      return new Response(JSON.stringify({ error: "action is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    switch (action) {
      case "whatsapp_incoming": {
        const { from, message_body, profile_name } = data || {};
        if (!message_body) throw new Error("message_body required");

        // Forward to ai-chat for AI response
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

        const aiResp = await fetch(`${supabaseUrl}/functions/v1/ai-chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({
            action: "whatsapp_message",
            action_data: { from, message_body },
          }),
        });

        const aiResult = await aiResp.json();
        
        return new Response(JSON.stringify({
          success: true,
          reply: aiResult.reply,
          from,
          profile_name,
          // n8n can use this reply to send back via WhatsApp Business API
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "create_receipt": {
        const { customer_name, items, payment_method, notes } = data || {};
        if (!customer_name || !items?.length) throw new Error("customer_name and items required");

        let total = 0;
        const processedItems = [];

        for (const item of items) {
          // Look up product by name if no product_id
          let productId = item.product_id;
          let unitPrice = item.unit_price || 0;

          if (!productId && item.product_name) {
            const { data: prods } = await admin
              .from("medicines")
              .select("id, price, stock")
              .ilike("name", `%${item.product_name}%`)
              .limit(1);
            
            if (prods?.length) {
              productId = prods[0].id;
              unitPrice = unitPrice || prods[0].price;
            }
          }

          const finalPrice = item.negotiated_price || unitPrice;
          const amount = finalPrice * (item.quantity || 1);
          total += amount;

          processedItems.push({
            product_id: productId,
            quantity: item.quantity || 1,
            unit_price: unitPrice,
            custom_unit_price: item.negotiated_price || null,
            amount,
          });
        }

        // Create order
        const { data: order, error: orderErr } = await admin.from("orders").insert({
          customer_name,
          total,
          payment_method: payment_method || "cash",
          notes: notes || "Created via n8n automation",
          status: "completed",
          sale_date: new Date().toISOString(),
        }).select("id").single();

        if (orderErr) throw orderErr;

        // Create order items
        for (const item of processedItems) {
          await admin.from("order_items").insert({
            order_id: order.id,
            ...item,
          });

          // Deduct stock
          if (item.product_id) {
            const { data: prod } = await admin.from("medicines").select("stock").eq("id", item.product_id).single();
            if (prod) {
              await admin.from("medicines").update({ stock: Math.max(0, prod.stock - item.quantity) }).eq("id", item.product_id);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          order_id: order.id,
          customer_name,
          total,
          items_count: processedItems.length,
          message: `Receipt created: UGX ${total.toLocaleString()}`,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "check_stock": {
        const { product_name, low_stock_only } = data || {};
        let query = admin.from("medicines").select("id, name, price, stock, unit, expiry_date, is_active");
        
        if (product_name) {
          query = query.ilike("name", `%${product_name}%`);
        }
        if (low_stock_only) {
          query = query.lte("stock", 10);
        }
        
        const { data: products } = await query.limit(50);
        
        return new Response(JSON.stringify({ success: true, products, count: products?.length || 0 }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "get_customer": {
        const { customer_name, phone } = data || {};
        let query = admin.from("customer_credits").select("*");
        
        if (customer_name) query = query.ilike("customer_name", `%${customer_name}%`);
        if (phone) query = query.ilike("customer_phone", `%${phone}%`);
        
        const { data: customers } = await query.limit(10);
        
        return new Response(JSON.stringify({ success: true, customers }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_stock": {
        const { product_name, product_id, new_stock, adjustment } = data || {};
        
        let targetId = product_id;
        if (!targetId && product_name) {
          const { data: prods } = await admin.from("medicines").select("id").ilike("name", `%${product_name}%`).limit(1);
          targetId = prods?.[0]?.id;
        }
        
        if (!targetId) throw new Error("Product not found");

        if (new_stock !== undefined) {
          await admin.from("medicines").update({ stock: new_stock }).eq("id", targetId);
        } else if (adjustment) {
          const { data: prod } = await admin.from("medicines").select("stock").eq("id", targetId).single();
          if (prod) {
            await admin.from("medicines").update({ stock: Math.max(0, prod.stock + adjustment) }).eq("id", targetId);
          }
        }

        return new Response(JSON.stringify({ success: true, product_id: targetId }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "daily_report": {
        const today = new Date().toISOString().split("T")[0];
        const [ordersRes, expensesRes, lowStockRes] = await Promise.all([
          admin.from("orders").select("total, payment_method, customer_name").gte("sale_date", today),
          admin.from("journal_lines").select("debit, account_name").eq("account_type", "expense").gte("entry_date", today),
          admin.from("medicines").select("name, stock").lte("stock", 10).eq("is_active", true),
        ]);

        const orders = ordersRes.data || [];
        const expenses = expensesRes.data || [];
        const totalSales = orders.reduce((s, o) => s + (o.total || 0), 0);
        const totalExpenses = expenses.reduce((s, e) => s + (e.debit || 0), 0);

        return new Response(JSON.stringify({
          success: true,
          date: today,
          total_sales: totalSales,
          total_expenses: totalExpenses,
          net_profit: totalSales - totalExpenses,
          orders_count: orders.length,
          low_stock_items: lowStockRes.data?.length || 0,
          low_stock_products: (lowStockRes.data || []).map(p => `${p.name} (${p.stock})`),
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (e: any) {
    console.error("n8n-webhook error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
