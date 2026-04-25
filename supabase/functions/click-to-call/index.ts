// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Agent → env var mapping (keys never exposed to frontend)
const AGENT_KEY_MAP: Record<string, string | undefined> = {
  pujita:  Deno.env.get("SMARTFLO_API_KEY_PUJITA"),
  aditya:  Deno.env.get("SMARTFLO_API_KEY_ADITYA"),
  gautami: Deno.env.get("SMARTFLO_API_KEY_GAUTAMI"),
};

const VALID_AGENTS = Object.keys(AGENT_KEY_MAP);
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      phone,
      agent,
      caller_id,
      customer_ring_timeout,
      call_timeout,
      custom_identifier,
    } = await req.json();

    // ── Validate phone ────────────────────────────────────────────────────────
    if (!phone) {
      return new Response(
        JSON.stringify({ success: false, error: "phone is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const digits = String(phone).replace(/\D/g, "");
    const normalized = digits.startsWith("91") && digits.length === 12
      ? digits.slice(2)
      : digits;

    if (normalized.length !== 10) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid phone number: ${phone}. Must be a 10-digit Indian number.` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Validate agent ────────────────────────────────────────────────────────
    if (!agent) {
      return new Response(
        JSON.stringify({ success: false, error: `agent is required. Must be one of: ${VALID_AGENTS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const agentKey = agent.toLowerCase().trim();
    if (!VALID_AGENTS.includes(agentKey)) {
      return new Response(
        JSON.stringify({ success: false, error: `Invalid agent "${agent}". Must be one of: ${VALID_AGENTS.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = AGENT_KEY_MAP[agentKey];
    if (!apiKey) {
      console.error(`[click-to-call] Secret SMARTFLO_API_KEY_${agentKey.toUpperCase()} is not set`);
      return new Response(
        JSON.stringify({ success: false, error: `API key for agent "${agentKey}" is not configured on the server` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Build Smartflo payload ────────────────────────────────────────────────
    const payload: Record<string, unknown> = {
      api_key: apiKey,
      customer_number: normalized,
      async: 1,
      wrapup_time: 0,
      callback_url: `${SUPABASE_URL}/functions/v1/smartflo-webhook`,
    };
    if (caller_id)               payload.caller_id = caller_id;
    if (customer_ring_timeout)   payload.customer_ring_timeout = customer_ring_timeout;
    if (call_timeout)            payload.call_timeout = call_timeout;
    if (custom_identifier)       payload.custom_identifier = custom_identifier;

    console.log(`[click-to-call] Calling ${normalized} via agent: ${agentKey}`);

    // ── Call Smartflo API ─────────────────────────────────────────────────────
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

    console.log(`[click-to-call] Smartflo response (${res.status}) for agent ${agentKey}:`, text);

    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, error: `Smartflo error ${res.status}: ${text}` }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, agent: agentKey, data }),
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
