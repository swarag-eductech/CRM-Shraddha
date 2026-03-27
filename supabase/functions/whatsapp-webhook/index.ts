// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-interakt-secret",
};

/** Normalise phone to exactly 10 digits (assumes Indian numbers) */
function normalizeTo10Digits(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

serve(async (req: Request) => {
  // 1. Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // 2. Auth Check (optional secret header/query)
  const expectedSecret = Deno.env.get("WEBHOOK_SECRET") ?? "mysecret123";
  const url = new URL(req.url);
  const secretFromQuery = url.searchParams.get("secret") || "";
  const secretFromHeader = req.headers.get("x-interakt-secret") || "";
  
  const incomingSecret = secretFromHeader || secretFromQuery;

  if (incomingSecret !== expectedSecret) {
    console.warn(`[webhook] 401 - secret mismatch. Expected: ${expectedSecret}, got: ${incomingSecret}`);
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401, 
      headers: { ...CORS, "Content-Type": "application/json" } 
    });
  }

  try {
    // 3. Parse Body
    const bodyText = await req.text();
    console.log("[webhook] Full Payload received:", bodyText);
    const body = JSON.parse(bodyText);

    // 4. Extract data using Interakt payload structure
    const customer = body.data?.customer || {};
    const message = body.data?.message || {};

    const rawPhone = customer.phone || customer.whatsappNumber || customer.whatsapp_number || "";
    const name = customer.name || "Unknown";
    const messageText = message.text || message.body || "";

    // Log extracted fields
    console.log(`[webhook] Extracted — Phone: "${rawPhone}", Name: "${name}", Message: "${messageText}"`);

    // 5. Ignore Test/Missing Phone events
    const cleanPhone = normalizeTo10Digits(rawPhone);
    if (!cleanPhone || cleanPhone.length < 10) {
      console.log("[webhook] Missing or invalid phone (likely a test event). Returning 200.");
      return new Response(JSON.stringify({ success: true, info: "test event or missing phone" }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 6. Lead deduplication logic
    let leadId: string;
    
    const { data: existingLead } = await supabase
      .from("ttp_leads")
      .select("id")
      .eq("phone", cleanPhone)
      .limit(1)
      .single();

    if (existingLead) {
      leadId = existingLead.id;
      console.log(`[webhook] Existing lead found: ${leadId}`);
    } else {
      // Create new lead with specified status and source
      const { data: newLead, error: insertError } = await supabase
        .from("ttp_leads")
        .insert({
          name: name,
          phone: cleanPhone,
          source: "whatsapp",
          status: "new"
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      leadId = newLead.id;
      console.log(`[webhook] New lead auto-created: ${leadId}`);
    }

    // 7. Store Message in ttp_messages
    if (messageText) {
      const { error: msgErr } = await supabase
        .from("ttp_messages")
        .insert({
          lead_id: leadId,
          text: messageText,
          direction: "incoming", // normalized to DB constraint
          created_at: new Date().toISOString()
        });
      if (msgErr) console.error("[webhook] Error saving message:", msgErr.message);
    }

    // 8. Log Activity in ttp_activities
    const { error: actErr } = await supabase
      .from("ttp_activities")
      .insert({
        lead_id: leadId,
        type: "message_received",
        description: messageText || "WhatsApp message received",
        created_at: new Date().toISOString()
      });
    if (actErr) console.error("[webhook] Error logging activity:", actErr.message);

    // 9. Always return 200 success
    return new Response(JSON.stringify({ success: true, leadId }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Error: ${errorMsg}`);
    // Still return 200 success to prevent Interakt from retrying failed processing
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 200,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
