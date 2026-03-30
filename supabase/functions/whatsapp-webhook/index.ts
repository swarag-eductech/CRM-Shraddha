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

// Utility: send text message through Interakt API
async function sendWhatsApp(supabase: any, phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  // First try to get from DB settings
  const { data: settings } = await supabase.from("ttp_settings").select("whatsapp_api_key").eq("id", "default").single();
  let apiKey = settings?.whatsapp_api_key || Deno.env.get("INTERAKT_API_KEY");

  if (!apiKey) {
    const err = "INTERAKT_API_KEY not set in settings or env";
    console.warn(`[send-whatsapp] ${err} - would send to ${phone}: ${message}`);
    return { success: false, error: err };
  }

  const digits = String(phone || "").replace(/\D/g, "");
  const formattedPhone = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;

  if (formattedPhone.length !== 10) {
    const err = `Invalid phone for WhatsApp: ${phone}`;
    console.error(`[send-whatsapp] ${err}`);
    return { success: false, error: err };
  }

  const body = {
    countryCode: "+91",
    phoneNumber: formattedPhone,
    callbackData: "CRM",
    type: "Text",
    text: message,
  };

  try {
    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
      console.error(`[send-whatsapp] Interakt error (${res.status}): ${text}`);
      return { success: false, error: `Interakt ${res.status}: ${text}` };
    }

    console.log(`[send-whatsapp] Sent to ${formattedPhone}: ${text}`);
    return { success: true };
  } catch (err) {
    console.error(`[send-whatsapp] Exception: ${err}`);
    return { success: false, error: String(err) };
  }
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ─────────────────────────────────────────────────────────────────────────────
    // NEW: Manual message processing (CRM Outgoing)
    // ─────────────────────────────────────────────────────────────────────────────
    if (body.manual === true && body.leadId && body.message) {
      console.log(`[webhook] Manual/Outgoing message for lead: ${body.leadId}`);
      
      // 1. Get Phone for lead (needed to send WhatsApp)
      const { data: leadData } = await supabase.from("ttp_leads").select("phone").eq("id", body.leadId).single();
      const phone = leadData?.phone;

      let sendResult: { success: boolean; error?: string } = { success: true };
      if (phone) {
        sendResult = await sendWhatsApp(supabase, phone, body.message);
      } else {
        console.warn(`[webhook] No phone found for lead ${body.leadId}, just saving to DB.`);
      }

      // 2. Save to DB regardless of send success (or only if success? let's do both)
      const { error: msgErr } = await supabase
        .from("ttp_messages")
        .insert({
          lead_id: body.leadId,
          text: body.message,
          message_text: body.message,
          direction: "outgoing",
          created_at: new Date().toISOString()
        });

      if (msgErr) console.error("[webhook] Error saving manual message:", msgErr.message);

      // 3. Log activity
      await supabase.from("ttp_activities").insert({
        lead_id: body.leadId,
        type: "message_sent",
        description: body.message,
        created_at: new Date().toISOString()
      });

      return new Response(JSON.stringify({ success: sendResult.success, error: sendResult.error }), {
        status: 200,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // 4. Extract data using Interakt payload structure (for incoming webhooks)
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
          message_text: messageText,
          direction: "incoming",
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
