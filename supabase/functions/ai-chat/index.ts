import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_PAGES = [
  { path: "/admin", label: "Dashboard", description: "Overview with sales stats, low stock alerts, top debtors" },
  { path: "/admin/pos", label: "POS / Sales", description: "Point of sale terminal for creating sales" },
  { path: "/admin/inventory", label: "Inventory", description: "View and manage all products, stock levels, prices" },
  { path: "/admin/stock-purchase", label: "Stock Purchase", description: "Record new stock purchases from suppliers" },
  { path: "/admin/batches", label: "Batch Tracking", description: "Track product batches, expiry dates, FEFO" },
  { path: "/admin/preview", label: "Product Preview", description: "Preview how products appear to customers" },
  { path: "/admin/orders", label: "Orders", description: "View and manage customer orders" },
  { path: "/admin/sales-history", label: "Sales History", description: "Historical sales records and search" },
  { path: "/admin/reports", label: "Sales Report", description: "Sales analytics and reporting" },
  { path: "/admin/day-book", label: "Day Book", description: "Daily transaction ledger" },
  { path: "/admin/accounting", label: "Accounting", description: "Vouchers, ledger entries, financial records" },
  { path: "/admin/expenses", label: "Expenses", description: "Track and manage business expenses" },
  { path: "/admin/prescriptions", label: "Prescription Rules", description: "Dosage rules and prescription requirements" },
  { path: "/admin/credits", label: "Customer Accounts", description: "Customer credit balances and payment tracking" },
  { path: "/admin/analytics", label: "Customer Analytics", description: "Customer purchasing patterns and insights" },
  { path: "/admin/suppliers", label: "Suppliers", description: "Manage supplier information and contacts" },
  { path: "/admin/settings", label: "Settings", description: "App and business settings" },
];

const SYSTEM_PROMPT = `You are Marvid AI — the intelligent pharmacy assistant for Marvid Pharmacy. You are embedded in the admin dashboard and can perform real actions.

## Your Capabilities
1. **Navigate pages** — When user wants to go somewhere, include an ACTION block
2. **Customer Queries** — Answer about medicines, availability, pricing, dosage
3. **Receipt Generation** — Create formatted receipts with customer details
4. **Order Management** — Help create, track, manage orders
5. **Inventory Queries** — Check stock levels, expiry dates, batch info
6. **Price Negotiations** — Track negotiated prices
7. **Prescription Info** — Dosage guidance and requirements
8. **Business Insights** — Sales summaries, popular products, low stock alerts
9. **Edit/Delete** — Guide users through editing or deleting records

## ACTION SYSTEM
When you need to perform an action, include it in your response using this exact format:
\`\`\`action
{"type":"navigate","path":"/admin/inventory"}
\`\`\`

Available actions:
- **navigate**: Go to a page. Example: \`{"type":"navigate","path":"/admin/pos"}\`
- **create_receipt**: Create order. Example: \`{"type":"create_receipt","data":{...}}\`
- **check_stock**: Query stock. Example: \`{"type":"check_stock","product":"Panadol"}\`

## Available Pages
${ADMIN_PAGES.map(p => `- **${p.label}** (${p.path}): ${p.description}`).join("\n")}

## Navigation Rules
- When user says "go to inventory" or "open inventory" → navigate to /admin/inventory
- When user says "POS" or "sales" or "sell" → navigate to /admin/pos  
- When user says "dashboard" or "home" → navigate to /admin
- When user says "expenses" → navigate to /admin/expenses
- When user says "orders" → navigate to /admin/orders
- When user says "reports" or "sales report" → navigate to /admin/reports
- Match intent naturally. "Show me stock" → /admin/inventory, "I want to sell" → /admin/pos
- Always confirm what you're doing: "Navigating to Inventory..."

## Context
The user's current page is provided in the context. Use it to give relevant help.
Always be helpful, professional, and accurate. Respond in the same language the user writes in.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, conversation_id, action, action_data, context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // n8n webhook support
    if (action) {
      return await handleAction(adminClient, action, action_data, corsHeaders);
    }

    // Build context-enriched messages
    let contextMessages = [...(messages || [])];
    const lastMsg = contextMessages[contextMessages.length - 1]?.content?.toLowerCase() || "";

    // Add current page context
    if (context?.currentPage) {
      const pageName = ADMIN_PAGES.find(p => p.path === context.currentPage)?.label || context.currentPage;
      contextMessages.unshift({
        role: "system",
        content: `User is currently on: ${pageName} (${context.currentPage})`
      });
    }

    if (lastMsg.includes("receipt") || lastMsg.includes("order") || lastMsg.includes("buy") || lastMsg.includes("sell")) {
      const { data: recentOrders } = await adminClient
        .from("orders")
        .select("id, customer_name, total, status, payment_method, sale_date")
        .order("created_at", { ascending: false })
        .limit(5);
      if (recentOrders?.length) {
        contextMessages.unshift({ role: "system", content: `Recent orders: ${JSON.stringify(recentOrders)}` });
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
          contextMessages.unshift({ role: "system", content: `Products matching "${term}": ${JSON.stringify(products)}` });
          break;
        }
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...contextMessages],
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
          customer_name, total, payment_method: payment_method || "cash",
          notes, user_id, status: "completed", sale_date: new Date().toISOString(),
        }).select("id").single();
        if (error) throw error;
        for (const item of orderItems) {
          await client.from("order_items").insert({
            order_id: order.id, product_id: item.product_id,
            quantity: item.quantity, unit_price: item.unit_price,
            custom_unit_price: item.negotiated_price || null,
          });
          if (item.product_id) {
            const { data: prod } = await client.from("products").select("stock").eq("id", item.product_id).single();
            if (prod) await client.from("products").update({ stock: Math.max(0, prod.stock - item.quantity) }).eq("id", item.product_id);
          }
        }
        return new Response(JSON.stringify({ success: true, order_id: order.id, total, items: orderItems, message: `Receipt created for ${customer_name}. Total: UGX ${total.toLocaleString()}` }), { headers: { ...headers, "Content-Type": "application/json" } });
      }
      case "check_stock": {
        const { product_name } = data;
        const { data: products } = await client.from("products").select("name, price, stock, unit, expiry_date").ilike("name", `%${product_name}%`).limit(10);
        return new Response(JSON.stringify({ success: true, products }), { headers: { ...headers, "Content-Type": "application/json" } });
      }
      case "get_customer": {
        const { customer_name } = data;
        const { data: customers } = await client.from("customer_credits").select("*").ilike("customer_name", `%${customer_name}%`).limit(5);
        return new Response(JSON.stringify({ success: true, customers }), { headers: { ...headers, "Content-Type": "application/json" } });
      }
      case "whatsapp_message": {
        const { from, message_body } = data;
        const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: [{ role: "system", content: SYSTEM_PROMPT + `\n\nWhatsApp user: ${from}. Keep responses concise.` }, { role: "user", content: message_body }] }),
        });
        const result = await response.json();
        const reply = result.choices?.[0]?.message?.content || "Sorry, I couldn't process that.";
        return new Response(JSON.stringify({ success: true, reply, from }), { headers: { ...headers, "Content-Type": "application/json" } });
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...headers, "Content-Type": "application/json" } });
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...headers, "Content-Type": "application/json" } });
  }
}
