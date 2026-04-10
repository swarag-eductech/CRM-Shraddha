// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * Smartflo Call Event Webhook
 *
 * Smartflo POSTs call status events here via the callback_url set in
 * the click-to-call request. When the customer (B-leg) disconnects,
 * we call Smartflo's hangup API to terminate the agent (A-leg)
 * so the agent's phone automatically hangs up.
 *
 * Known Smartflo callback field variations:
 *   unique_id / uuid / call_uuid / session_id  – call identifier
 *   event_name / event / status / call_status  – DISCONNECT | HANGUP | COMPLETED
 *   leg_type / leg                             – B | customer | 2
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Extracts the call ID from whatever field Smartflo sends it in */
function extractUniqueId(body: Record<string, unknown>): string {
  // Smartflo webhook template uses 'uuid' — listed first
  return String(
    body.uuid ?? body.unique_id ?? body.call_uuid ?? body.call_id ?? body.session_id ?? body.callid ?? ""
  ).trim();
}

/** Returns true if the event indicates the call has ended */
function isCustomerDisconnect(body: Record<string, unknown>): boolean {
  const event = String(body.event_name ?? body.event ?? body.status ?? body.call_status ?? "").toUpperCase();
  const leg   = String(body.leg_type ?? body.leg ?? "").toUpperCase();

  // Terminal events from Smartflo
  const isTerminal = ["DISCONNECT", "HANGUP", "COMPLETED", "FAILED", "BUSY", "NO_ANSWER", "NOANSWER", "CALL_DISCONNECTED", "CALL_ENDED"].includes(event);

  // Customer leg identifiers — if leg is empty (dashboard webhook fires once per call end, no leg field)
  const isCustomerLeg = leg === "" || ["B", "CUSTOMER", "2"].includes(leg);

  console.log(`[smartflo-webhook] event=${event}, leg=${leg}, isTerminal=${isTerminal}, isCustomerLeg=${isCustomerLeg}`);

  return isTerminal && isCustomerLeg;
}

/** Calls Smartflo's hangup API — tries all known auth styles and endpoint names */
async function hangupCall(apiKey: string, uniqueId: string): Promise<{ status: number; body: string }> {
  // Attempt matrix: endpoint × auth style
  const attempts = [
    // Bearer token in Authorization header (Smartflo control/management APIs)
    {
      url: "https://api-smartflo.tatateleservices.com/v1/disconnect_call",
      headers: { "accept": "application/json", "content-type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ unique_id: uniqueId }),
    },
    // API key in body (same style as click_to_call_support)
    {
      url: "https://api-smartflo.tatateleservices.com/v1/disconnect_call",
      headers: { "accept": "application/json", "content-type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, unique_id: uniqueId }),
    },
    // Alternate endpoint name with Bearer
    {
      url: "https://api-smartflo.tatateleservices.com/v1/hangup_call",
      headers: { "accept": "application/json", "content-type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({ unique_id: uniqueId }),
    },
    // Alternate endpoint name with body key
    {
      url: "https://api-smartflo.tatateleservices.com/v1/hangup_call",
      headers: { "accept": "application/json", "content-type": "application/json" },
      body: JSON.stringify({ api_key: apiKey, unique_id: uniqueId }),
    },
  ];

  let lastStatus = 0;
  let lastBody = "";

  for (const attempt of attempts) {
    try {
      const res = await fetch(attempt.url, {
        method: "POST",
        headers: attempt.headers,
        body: attempt.body,
      });
      const text = await res.text();
      console.log(`[smartflo-webhook] hangup via ${attempt.url} (auth=${attempt.headers["Authorization"] ? "Bearer" : "body"}) → HTTP ${res.status}: ${text}`);
      lastStatus = res.status;
      lastBody = text;
      // 200 or 404 (call already ended naturally) = success; stop
      if (res.ok || res.status === 404) return { status: res.status, body: text };
    } catch (err) {
      console.warn(`[smartflo-webhook] attempt failed:`, err);
    }
  }

  return { status: lastStatus, body: lastBody };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SMARTFLO_API_KEY = Deno.env.get("SMARTFLO_API_KEY");
  if (!SMARTFLO_API_KEY) {
    console.error("[smartflo-webhook] SMARTFLO_API_KEY secret is not configured");
    return new Response(
      JSON.stringify({ error: "SMARTFLO_API_KEY not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Smartflo may POST as application/json or application/x-www-form-urlencoded
    let body: Record<string, unknown> = {};
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      body = await req.json();
    } else {
      const text = await req.text();
      // Try JSON parse first (some Smartflo versions send JSON without correct content-type)
      try {
        body = JSON.parse(text);
      } catch {
        const params = new URLSearchParams(text);
        for (const [key, value] of params.entries()) {
          body[key] = value;
        }
      }
    }

    // Always log full payload — essential for diagnosing field names Smartflo sends
    console.log("[smartflo-webhook] RAW event payload:", JSON.stringify(body));

    const uniqueId = extractUniqueId(body);

    if (!uniqueId) {
      console.warn("[smartflo-webhook] No call ID found in payload:", JSON.stringify(body));
      return new Response(
        JSON.stringify({ received: true, action: "no_unique_id", payload: body }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The Smartflo webhook trigger is "Call hangup" — every request means a call has ended.
    // Immediately hang up the agent leg so Zoiper disconnects.
    console.log(`[smartflo-webhook] Call ended — hanging up agent, uuid=${uniqueId}`);
    const { status, body: hangupBody } = await hangupCall(SMARTFLO_API_KEY, uniqueId);

    return new Response(
      JSON.stringify({ received: true, action: "agent_hungup", unique_id: uniqueId, hangup_status: status, hangup_response: hangupBody }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("[smartflo-webhook] Exception:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
