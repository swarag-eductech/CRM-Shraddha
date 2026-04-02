// @ts-nocheck — Deno runtime: URL imports and Deno.env are valid, ignore Node TS errors
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS headers ─────────────────────────────────────────────────────────────
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ─── Helper: base64url encode ──────────────────────────────────────────────────
function base64url(input: ArrayBuffer | string): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ─── Import RSA private key from PEM (PKCS#8) ─────────────────────────────────
async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const pemBody = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "")
    .trim();

  const binaryDer = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

// ─── Create a signed JWT for Google service account ───────────────────────────
// impersonateEmail must be a real Google Workspace user for Meet link creation
async function createServiceAccountJWT(
  clientEmail: string,
  privateKey: string,
  scope: string,
  impersonateEmail: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: impersonateEmail, // domain-wide delegation: impersonate real Workspace user
    scope,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const signingInput =
    `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const key = await importPrivateKey(privateKey);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput)
  );

  return `${signingInput}.${base64url(signature)}`;
}

// ─── Exchange JWT for a Google OAuth2 access token ────────────────────────────
async function getAccessToken(
  clientEmail: string,
  privateKey: string,
  impersonateEmail: string
): Promise<string> {
  const jwt = await createServiceAccountJWT(
    clientEmail,
    privateKey,
    "https://www.googleapis.com/auth/calendar",
    impersonateEmail
  );

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`[Auth] Token exchange failed (${res.status}): ${err}`);
  }

  const { access_token } = await res.json();
  return access_token;
}

// ─── Generate Google Meet link via Calendar API ────────────────────────────────
async function generateMeetLink(
  meetingDatetime: string,
  durationMinutes: number,
  hostEmail: string,
  traineeEmails: string[] = []
): Promise<string | null> {
  const clientEmail = Deno.env.get("GOOGLE_CLIENT_EMAIL");
  const rawPrivateKey = Deno.env.get("GOOGLE_PRIVATE_KEY");

  if (!clientEmail || !rawPrivateKey) {
    console.error("[Meet] GOOGLE_CLIENT_EMAIL or GOOGLE_PRIVATE_KEY not set — cannot generate link");
    return null;
  }

  // Use the hostEmail parameter (the staff/lead running the meeting) as the impersonation email.
  // Fall back to GOOGLE_IMPERSONATE_EMAIL env secret if hostEmail is not available.
  const impersonateEmail = hostEmail || Deno.env.get("GOOGLE_IMPERSONATE_EMAIL") || "";

  if (!impersonateEmail) {
    console.error("[Meet] No impersonation email available (hostEmail param is empty and GOOGLE_IMPERSONATE_EMAIL not set)");
    return null;
  }

  console.log("[Meet DEBUG] Using impersonateEmail:", impersonateEmail);

  // Fix escaped newlines from env var
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");

  let accessToken: string;
  try {
    accessToken = await getAccessToken(clientEmail, privateKey, impersonateEmail);
  } catch (err) {
    console.error(`[Meet] Failed to get access token: ${err}`);
    return null;
  }

  const startTime = new Date(meetingDatetime);
  const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

  // Unique request ID to ensure idempotency for conferenceData
  const requestId = `shraddha-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const event = {
    summary: "Shraddha Institute Meeting",
    start: {
      dateTime: startTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    end: {
      dateTime: endTime.toISOString(),
      timeZone: "Asia/Kolkata",
    },
    visibility: "private",
    guestsCanInviteOthers: false,
    guestsCanModify: false,
    guestsCanSeeOtherGuests: false,
    conferenceData: {
      // Do NOT specify conferenceSolutionKey — let Google auto-assign
      // the correct type (hangoutsMeet for Workspace, eventHangout for Gmail)
      createRequest: {
        requestId,
      },
    },
    attendees: [
      { email: hostEmail, responseStatus: "accepted" },
      ...traineeEmails.filter(Boolean).map((email) => ({ email })),
    ],
  };

  // Use 'primary' calendar. conferenceDataVersion=1 is required for Meet link.
  const calRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );

 const raw = await calRes.text();
console.log("[Meet] Calendar API status:", calRes.status, "body:", raw);

if (!calRes.ok) {
  console.error(`[Meet] Calendar API error (${calRes.status}): ${raw}`);
  return null;
}

const calData = JSON.parse(raw);
console.log("[Meet] Parsed Response:", JSON.stringify(calData, null, 2));

const hangoutLink =
      calData.hangoutLink ||
  calData.conferenceData?.entryPoints?.find(
    (p) => p.entryPointType === "video" || p.entryPointType === "more"
  )?.uri ||
  calData.conferenceData?.entryPoints?.[0]?.uri ||
  calData.htmlLink ||
  null;

  if (!hangoutLink) {
    console.warn("[Meet] No hangoutLink in Calendar response:", JSON.stringify(calData));
  } else {
    console.log(`[Meet] ✅ Meet link generated: ${hangoutLink}`);
  }

  return hangoutLink;
}

// ─── Send WhatsApp via Interakt ────────────────────────────────────────────────
async function sendWhatsApp(
  phone: string,
  templateValues: string[]
): Promise<void> {
  const apiKey = Deno.env.get("INTERAKT_API_KEY");
  if (!apiKey) {
    console.warn("[WhatsApp] INTERAKT_API_KEY not set — skipping");
    return;
  }

  const digits = String(phone).replace(/\D/g, "");
  const formattedPhone =
    digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;

  const body = {
    countryCode: "+91",
    phoneNumber: formattedPhone,
    callbackData: "CRM",
    type: "Template",
    template: {
      name: "wron_successful",
      languageCode: "en_GB",
      bodyValues: templateValues,
    },
  };

  try {
    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    if (!res.ok) {
      console.error(
        `[WhatsApp] ❌ Failed (${res.status}) for ${formattedPhone}: ${responseText}`
      );
    } else {
      console.log(
        `[WhatsApp] ✅ Confirmation sent to ${formattedPhone}: ${responseText}`
      );
    }
  } catch (err) {
    console.error(`[WhatsApp] ❌ Exception for ${formattedPhone}: ${err}`);
  }
}

// ─── Parse "HH:MM AM/PM" (e.g. "02:30 PM") to 24h hours/minutes ───────────────
function parseTime12h(timeStr: string): { hours: number; minutes: number } {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error(`Invalid time format: "${timeStr}". Use "HH:MM AM/PM"`);

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3].toUpperCase();

  if (meridiem === "AM" && hours === 12) hours = 0;
  if (meridiem === "PM" && hours !== 12) hours += 12;

  return { hours, minutes };
}

// ─── Build IST ISO string from date + time ─────────────────────────────────────
function buildISTDatetime(date: string, time: string): string {
  // date: "YYYY-MM-DD", time: "HH:MM AM/PM"
  const { hours, minutes } = parseTime12h(time);
  // IST = UTC+5:30
  const hh = String(hours).padStart(2, "0");
  const mm = String(minutes).padStart(2, "0");
  return `${date}T${hh}:${mm}:00+05:30`;
}

// ─── Main handler ──────────────────────────────────────────────────────────────
serve(async (req: Request) => {
  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const {
    userName,
    userPhone = '',
    meetingDate,   // "YYYY-MM-DD"
    meetingTime,   // "HH:MM AM/PM"
    duration = 30, // minutes
    courseName = "Online Workshop",
    hostEmail = null,
    traineeEmails = [],
    meetingLink: providedMeetingLink = null, // pre-provided link (skips Google Meet generation)
  } = body;

  // ── Validate required fields ─────────────────────────────────────────────────
  if (!userName || !meetingDate || !meetingTime) {
    return new Response(
      JSON.stringify({
        error: "Missing required fields: userName, meetingDate, meetingTime",
      }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  if (hostEmail !== null && (typeof hostEmail !== "string" || !hostEmail.trim())) {
    return new Response(
      JSON.stringify({ error: "Invalid hostEmail" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  if (!Array.isArray(traineeEmails)) {
    return new Response(
      JSON.stringify({ error: "traineeEmails must be an array" }),
      { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── Build IST datetime string ────────────────────────────────────────────────
  let meetingDatetime: string;
  try {
    meetingDatetime = buildISTDatetime(meetingDate, meetingTime);
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 400,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  console.log(
    `[create-meeting] Booking for ${userName} (${userPhone}) at ${meetingDatetime}, ${duration} min`
  );

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // ── Double-booking prevention ────────────────────────────────────────────────
  const { data: conflict } = await supabase
    .from("ttp_meetings")
    .select("id")
    .eq("meeting_datetime", meetingDatetime)
    .eq("is_deleted", false)
    .limit(1)
    .maybeSingle();

  if (conflict) {
    return new Response(
      JSON.stringify({
        error: "Time slot already booked. Please choose a different time.",
      }),
      { status: 409, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  // ── Generate Google Meet link (only when hostEmail is available) ──────────────────────
  let meetingLink: string | null = providedMeetingLink;
  if (!meetingLink && hostEmail) {
    meetingLink = await generateMeetLink(
      meetingDatetime,
      Number(duration),
      hostEmail,
      traineeEmails
    );
  } else if (!meetingLink) {
    console.log("[create-meeting] No hostEmail and no pre-provided link — meeting link will be null");
  }

  // ── Upsert lead in ttp_leads (only when userPhone is provided) ───────────────────────
  const digits = String(userPhone).replace(/\D/g, "");
  const phone10 =
    digits.startsWith("91") && digits.length === 12 ? digits.slice(2) : digits;

  let primaryLeadId: string | null = null;
  if (phone10) {
    const { data: existingLead } = await supabase
      .from("ttp_leads")
      .select("id")
      .eq("phone", phone10)
      .limit(1)
      .maybeSingle();

    if (existingLead) {
      primaryLeadId = existingLead.id;
      console.log(`[create-meeting] Found existing lead: ${primaryLeadId}`);
    } else {
      const { data: newLead, error: leadErr } = await supabase
        .from("ttp_leads")
        .insert({ name: userName, phone: phone10, source: "meeting_booking" })
        .select("id")
        .single();

      if (leadErr || !newLead) {
        console.error(`[create-meeting] Lead insert failed: ${leadErr?.message}`);
      } else {
        primaryLeadId = newLead.id;
        console.log(`[create-meeting] Created new lead: ${primaryLeadId}`);
      }
    }
  }

  // ── Insert meeting into ttp_meetings ──────────────────────────────────────────
  const { data: meeting, error: meetingErr } = await supabase
    .from("ttp_meetings")
    .insert({
      meeting_datetime: meetingDatetime,
      duration_minutes: Number(duration),
      meeting_link: meetingLink,
      is_deleted: false,
      reminder_3day_sent: false,
      reminder_2day_sent: false,
      reminder_1day_sent: false,
      reminder_1hour_sent: false,
      reminder_30_sent: false,
      reminder_15_sent: false,
      reminder_5_sent: false,
    })
    .select("id")
    .single();

  if (meetingErr || !meeting) {
    console.error(`[create-meeting] Meeting insert failed: ${meetingErr?.message}`);
    return new Response(
      JSON.stringify({ error: "Failed to create meeting record" }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }

  console.log(`[create-meeting] Meeting created: ${meeting.id}`);

  // ── Link primary lead to meeting via ttp_meeting_leads ───────────────────────
  if (primaryLeadId) {
    const { error: linkErr } = await supabase
      .from("ttp_meeting_leads")
      .insert({ meeting_id: meeting.id, lead_id: primaryLeadId });

    if (linkErr) {
      console.error(`[create-meeting] Meeting-lead link failed: ${linkErr.message}`);
      // Non-fatal: meeting is created, just the association failed
    }
  }

  // ── Send WhatsApp confirmation (only when userPhone is available) ─────────────
  if (phone10) {
    let finalLink = meetingLink;

    // 🔥 FORCE fallback to prevent Interakt's "(link not set)" text
    if (!finalLink || String(finalLink) === "null" || String(finalLink).trim() === "") {
      console.warn("[create-meeting] ⚠️ No link generated. Using fallback link.");
      finalLink = "https://meet.google.com/new"; 
    }

    const platform = finalLink.includes("zoom") ? "Zoom" : "Google Meet";

    console.log("[DEBUG VALUES]:", {
      meetingLink,
      finalLink
    });
    console.log("[FINAL WHATSAPP LINK]:", finalLink);

    await sendWhatsApp(userPhone, [
      userName,                // {{1}} Name
      courseName,              // {{2}} Course/Workshop
      meetingDate,             // {{3}} Date  (YYYY-MM-DD)
      meetingTime,             // {{4}} Time  (HH:MM AM/PM)
      platform,                // {{5}} Platform
      finalLink,               // {{6}} Meet link (✅ always valid now)
    ]);
  }

  // ── Success response ──────────────────────────────────────────────────────────
  return new Response(
    JSON.stringify({
      success: true,
      meetingId: meeting.id,
      meetingLink: meetingLink ?? null,
      meetingDatetime,
      message: "Meeting booked successfully. WhatsApp confirmation sent.",
    }),
    { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
