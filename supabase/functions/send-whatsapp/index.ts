// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Utility: send text message through Interakt API
async function sendWhatsApp(phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = Deno.env.get("INTERAKT_API_KEY");
  if (!apiKey) {
    const err = "INTERAKT_API_KEY not set";
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
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "content-type, authorization, x-client-info, apikey",
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Only POST allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: "Invalid JSON body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const phone = String(body?.phone || "").trim();
  const message = String(body?.message || "").trim();

  if (!phone) {
    return new Response(JSON.stringify({ success: false, error: "Missing phone" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!message) {
    return new Response(JSON.stringify({ success: false, error: "Missing message" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const result = await sendWhatsApp(phone, message);

  // Archive in Database if successful (or even if failed, but usually for success)
  if (result.success) {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    let leadId = body.leadId;
    if (!leadId) {
      // Look up lead by phone if leadId not provided
      const digits = phone.replace(/\D/g, "");
      const phone10 = digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;
      const { data: lead } = await supabase.from("ttp_leads").select("id").eq("phone", phone10).maybeSingle();
      if (lead) leadId = lead.id;
    }

    if (leadId) {
      await supabase.from("ttp_messages").insert({
        lead_id: leadId,
        text: message,
        message_text: message,
        direction: "outgoing",
        created_at: new Date().toISOString(),
      });
      await supabase.from("ttp_activities").insert({
        lead_id: leadId,
        type: "message_sent",
        description: message,
        created_at: new Date().toISOString(),
      });
    }
  }

  return new Response(JSON.stringify(result), {
    status: result.success ? 200 : 500,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
});
