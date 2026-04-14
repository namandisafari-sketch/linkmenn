import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const action = body.action || "bootstrap";

    if (action === "upsert-stock") {
      const { products } = body;
      if (!products || !Array.isArray(products)) throw new Error("products array required");
      let updated = 0, failed = 0;
      for (let i = 0; i < products.length; i += 50) {
        const batch = products.slice(i, i + 50);
        for (const p of batch) {
          const { error } = await adminClient.from("products").upsert({
            id: p.id,
            name: p.name,
            price: p.price || 0,
            stock: p.stock || 0,
            unit: p.unit || "Piece",
            batch_number: p.batch_number || null,
            expiry_date: p.expiry_date || null,
            is_active: p.is_active !== false,
            category_id: p.category_id || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: "id" });
          if (error) { console.error(p.name, error); failed++; } else { updated++; }
        }
      }
      return new Response(
        JSON.stringify({ success: true, updated, failed }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "import-products") {
      const { categories, products } = body;
      
      if (!products || !Array.isArray(products)) {
        throw new Error("products array is required");
      }

      // Clear existing data
      await adminClient.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      await adminClient.from("categories").delete().neq("id", "00000000-0000-0000-0000-000000000000");

      // Insert categories
      const categoryMap: Record<string, string> = {};
      if (categories && Array.isArray(categories)) {
        for (const catName of categories) {
          const { data, error } = await adminClient.from("categories").insert({ name: catName }).select("id").single();
          if (error) {
            console.error(`Category insert error for ${catName}:`, error);
            continue;
          }
          categoryMap[catName] = data.id;
        }
      }

      // Insert products in batches of 50
      let inserted = 0;
      let skipped = 0;
      for (let i = 0; i < products.length; i += 50) {
        const batch = products.slice(i, i + 50).map((p: any) => ({
          name: p.name,
          category_id: categoryMap[p.category] || null,
          stock: p.stock || 0,
          unit: p.unit || "Piece",
          buying_price: p.buying_price || 0,
          price: p.price || 0,
          expiry_date: p.expiry_date || null,
          batch_number: p.batch_number || null,
          is_active: p.is_active !== false,
        }));
        const { error } = await adminClient.from("products").insert(batch);
        if (error) {
          console.error(`Batch ${i} error:`, error);
          skipped += batch.length;
        } else {
          inserted += batch.length;
        }
      }

      return new Response(
        JSON.stringify({ success: true, inserted, skipped, categories: Object.keys(categoryMap).length }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default: bootstrap admin
    const email = "admin@marvid.app";
    const password = "Marvid@2026";

    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existing = existingUsers?.users?.find((u: any) => u.email === email);

    let userId: string;

    if (existing) {
      userId = existing.id;
      await adminClient.auth.admin.updateUserById(userId, {
        password,
        email_confirm: true,
      });
    } else {
      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;
      userId = newUser.user.id;
    }

    const { data: roleCheck } = await adminClient
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: userId, role: "admin" });
      if (roleError) throw roleError;
    }

    return new Response(
      JSON.stringify({ success: true, message: "Admin account ready", userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
