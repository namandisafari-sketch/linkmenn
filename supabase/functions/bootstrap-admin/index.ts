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

    if (action === "import-products") {
      const { products } = body;
      if (!products || !Array.isArray(products)) {
        throw new Error("products array is required");
      }

      // Delete all existing products (order_items FK may block, so delete order_items first if needed)
      await adminClient.from("order_items").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      const { error: delErr } = await adminClient.from("products").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (delErr) throw delErr;

      // Insert in batches of 50
      let inserted = 0;
      for (let i = 0; i < products.length; i += 50) {
        const batch = products.slice(i, i + 50);
        const { error } = await adminClient.from("products").insert(batch);
        if (error) throw error;
        inserted += batch.length;
      }

      return new Response(
        JSON.stringify({ success: true, inserted }),
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
      JSON.stringify({ success: true, message: "Admin account ready" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
