import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are Marvid AI — the intelligent pharmacy assistant for Marvid Pharmacy. You help with:

1. **Customer Queries**: Answer questions about medicines, availability, pricing, dosage info
2. **Receipt Generation**: When asked to create a receipt, format it clearly with:
   - Customer name
   - Items purchased with quantities and prices
   - Any negotiated prices (show original vs negotiated)
   - Total amount
   - Payment method
   - Date
3. **Order Management**: Help create, track, and manage orders
4. **Inventory Queries**: Check stock levels, expiry dates, batch info
5. **Price Negotiations**: Track and record negotiated prices
6. **Prescription Info**: Provide dosage guidance and prescription requirements
7. **Business Insights**: Sales summaries, popular products, low stock alerts

When generating receipts or structured data, use clean formatting with clear headers.
Always be helpful, professional, and accurate. If unsure about specific medicine info, recommend consulting a pharmacist.

You can be reached via the app chat or WhatsApp. Respond in the same language the user writes in.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, conversation_id, action, action_data } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // n8n webhook support: if action is provided, handle structured commands
    if (action) {
      return await handleAction(adminClient, action, action_data, corsHeaders);
    }

    // Enrich context with pharmacy data when relevant
    let contextMessages = [...(messages || [])];
    const lastMsg = contextMessages[contextMessages.length - 1]?.content?.toLowerCase() || "";
    
    if (lastMsg.includes("receipt") || lastMsg.includes("order") || lastMsg.includes("buy") || lastMsg.includes("sell")) {
      // Fetch recent orders for context
      const { data: recentOrders } = await adminClient
        .from("orders")
        .select("id, customer_name, total, status, payment_method, sale_date")
        .order("created_at", { ascending: false })
        .limit(5);
      
      if (recentOrders?.length) {
        contextMessages.unshift({
          role: "system",
          content: `Recent orders context: ${JSON.stringify(recentOrders)}`
        });
      }
    }

    if (lastMsg.includes("stock") || lastMsg.includes("medicine") || lastMsg.includes("available") || lastMsg.includes("price")) {
      const searchTerms = lastMsg.split(" ").filter((w: string) => w.length > 3);
      for (const term of searchTerms.slice(0, 3)) {
        const { data: products } = await adminClient
          .from("products")
          .select("name, price, stock, unit, is_active")
          .ilike("name", `%${term}%`)
          .limit(10);
        
        if (products?.length) {
          contextMessages.unshift({
            role: "system",
            content: `Products matching "${term}": ${JSON.stringify(products)}`
          });
          break;
        }
      }
    }

    // Call AI
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...contextMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits depleted. Please add funds." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      throw new Error("AI service unavailable");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e: any) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Handle structured actions (for n8n automation)
async function handleAction(client: any, action: string, data: any, headers: any) {
  try {
    switch (action) {
      case "create_receipt": {
        const { customer_name, items, payment_method, notes, user_id } = data;
        let total = 0;
        const orderItems = items.map((item: any) => {
          const price = item.negotiated_price || item.unit_price;
          const amount = price * item.quantity;
          total += amount;
          return { ...item, final_price: price, amount };
        });

        const { data: order, error } = await client.from("orders").insert({
          customer_name,
          total,
          payment_method: payment_method || "cash",
          notes,
          user_id,
          status: "completed",
          sale_date: new Date().toISOString(),
        }).select("id").single();

        if (error) throw error;

        for (const item of orderItems) {
          await client.from("order_items").insert({
            order_id: order.id,
            product_id: item.product_id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            custom_unit_price: item.negotiated_price || null,
          });

          // Update stock
          if (item.product_id) {
            const { data: prod } = await client.from("products").select("stock").eq("id", item.product_id).single();
            if (prod) {
              await client.from("products").update({ stock: Math.max(0, prod.stock - item.quantity) }).eq("id", item.product_id);
            }
          }
        }

        return new Response(JSON.stringify({
          success: true,
          order_id: order.id,
          total,
          items: orderItems,
          message: `Receipt created for ${customer_name}. Total: UGX ${total.toLocaleString()}`
        }), { headers: { ...headers, "Content-Type": "application/json" } });
      }

      case "check_stock": {
        const { product_name } = data;
        const { data: products } = await client
          .from("products")
          .select("name, price, stock, unit, expiry_date")
          .ilike("name", `%${product_name}%`)
          .limit(10);
        
        return new Response(JSON.stringify({ success: true, products }), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      case "get_customer": {
        const { customer_name } = data;
        const { data: customers } = await client
          .from("customer_credits")
          .select("*")
          .ilike("customer_name", `%${customer_name}%`)
          .limit(5);
        
        return new Response(JSON.stringify({ success: true, customers }), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      case "whatsapp_message": {
        // Process WhatsApp message and generate AI response
        const { from, message_body } = data;
        const messages = [{ role: "user", content: message_body }];
        
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: SYSTEM_PROMPT + `\n\nThis message is from WhatsApp user: ${from}. Keep responses concise for WhatsApp.` },
              ...messages,
            ],
          }),
        });

        const result = await response.json();
        const reply = result.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
        
        return new Response(JSON.stringify({ success: true, reply, from }), {
          headers: { ...headers, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...headers, "Content-Type": "application/json" },
        });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...headers, "Content-Type": "application/json" },
    });
  }
}
