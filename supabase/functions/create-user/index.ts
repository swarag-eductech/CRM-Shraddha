// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    // Only service role can create auth users — use SUPABASE_SERVICE_ROLE_KEY
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Verify the caller is an admin (has is_admin metadata)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: CORS });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: { user: caller }, error: callerErr } = await supabaseUser.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (callerErr || !caller || caller.user_metadata?.is_admin !== true) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: CORS });
    }

    const { name, email, password, role = "user" } = await req.json();

    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: "name, email and password are required" }),
        { status: 400, headers: CORS }
      );
    }

    // Create auth user
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        is_admin: role === "admin",
      },
    });

    if (createErr) {
      return new Response(JSON.stringify({ error: createErr.message }), { status: 400, headers: CORS });
    }

    // Insert into crm_users
    const { error: dbErr } = await supabaseAdmin.from("crm_users").upsert([
      { id: created.user.id, name, email, role }
    ], { onConflict: "id" });

    if (dbErr) {
      console.error("[create-user] crm_users insert error:", dbErr.message);
      // Non-fatal — auth user created successfully
    }

    return new Response(
      JSON.stringify({
        success: true,
        user: { id: created.user.id, name, email, role },
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[create-user] Exception:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: CORS });
  }
});
