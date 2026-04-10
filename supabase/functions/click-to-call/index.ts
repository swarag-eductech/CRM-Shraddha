// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SMARTFLO_API_KEY = Deno.env.get("SMARTFLO_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      phone,
      caller_id,
      customer_ring_timeout,
      call_timeout,
      custom_identifier,
    } = await req.json();

    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize: strip non-digits, ensure 10-digit Indian number
    const digits = String(phone).replace(/\D/g, "");
    const normalized = digits.startsWith("91") && digits.length === 12
      ? digits.slice(2)
      : digits;

    if (normalized.length !== 10) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid phone number: ${phone}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build request body — only include optional fields if provided
    if (!SMARTFLO_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: "SMARTFLO_API_KEY secret is not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: Record<string, unknown> = {
      api_key: SMARTFLO_API_KEY,
      customer_number: normalized,
      async: 1,        // required: asynchronous mode
      wrapup_time: 0,  // 0 = immediately disconnect agent when customer hangs up
      callback_url: `${SUPABASE_URL}/functions/v1/smartflo-webhook`,
    };
    if (caller_id) payload.caller_id = caller_id;
    if (customer_ring_timeout) payload.customer_ring_timeout = customer_ring_timeout;
    if (call_timeout) payload.call_timeout = call_timeout;
    if (custom_identifier) payload.custom_identifier = custom_identifier;

    // Smartflo Click to Call Support API — correct endpoint
    const res = await fetch("https://api-smartflo.tatateleservices.com/v1/click_to_call_support", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await res.text();
    let data: unknown;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    console.log(`[click-to-call] Smartflo response (${res.status}):`, text);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Smartflo error ${res.status}: ${text}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[click-to-call] Exception:", err);
    return new Response(
      JSON.stringify({ success: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
