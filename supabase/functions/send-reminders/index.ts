// @ts-nocheck  — Deno runtime: URL imports and Deno.env are valid, ignore Node TS errors
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── WhatsApp sender via Interakt API ────────────────────────────────────────
async function sendWhatsApp(
  phone: string,
  message: string | null,
  template?: { name: string; values: string[] }
): Promise<boolean> {
  const apiKey = Deno.env.get("INTERAKT_API_KEY");

  if (!apiKey) {
    console.warn(`[WhatsApp] INTERAKT_API_KEY not set — would send to ${phone}: ${message || template?.name}`);
    return false;
  }

  // Strip everything except digits, then remove leading country code if already present
  const digits = phone.replace(/\D/g, "");
  // Remove leading 91 so we pass only the 10-digit number
  const formattedPhone = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits;

  console.log(`[WhatsApp] Sending to: ${formattedPhone} (Template: ${template?.name ?? "None"})`);

  // Interakt uses the API key directly — no base64 encoding of the key itself
  const authHeader = `Basic ${apiKey}`;

  try {
    const body: any = {
      countryCode: "+91",
      phoneNumber: formattedPhone,
      callbackData: "CRM",
      type: "Template",
      template: {
        name: template?.name ?? "wron_successful",
        languageCode: "en_GB",
        bodyValues: template?.values ?? [],
      },
    };

    const payloadString = JSON.stringify(body);
    console.log(`[WhatsApp] Body: ${payloadString}`);

    const res = await fetch("https://api.interakt.ai/v1/public/message/", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: payloadString,
    });

    const responseText = await res.text();

    if (!res.ok) {
      console.error(`[WhatsApp] ❌ Failed for ${formattedPhone} (${res.status}): ${responseText}`);
      return false;
    }

    console.log(`[WhatsApp] ✅ Sent to ${formattedPhone} — response: ${responseText}`);
    return true;
  } catch (err) {
    console.error(`[WhatsApp] ❌ Exception for ${formattedPhone}: ${err}`);
    return false;
  }
}

// ─── Insert notification helper ───────────────────────────────────────────────
async function insertNotification(
  supabase: any,
  userId: string | null,
  title: string,
  message: string,
  type: string
): Promise<void> {
  const { error } = await supabase.from("ttp_notifications").insert({
    user_id: userId,
    title,
    message,
    type,
    is_read: false,
  });
  if (error) console.error(`[Notification] Insert failed: ${error.message}`);
}

// ─── Main handler ─────────────────────────────────────────────────────────────
serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const nowUTC = new Date();
  const todayDate = nowUTC.toISOString().split("T")[0]; // YYYY-MM-DD in UTC

  const stats = { followups: 0, meetings: 0, daily: 0, errors: [] as string[] };

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 1: FOLLOW-UP REMINDERS
  // Trigger: now >= next_followup_at AND reminder_sent = false
  // ═══════════════════════════════════════════════════════════════════════════
  const { data: pendingFollowups, error: followupError } = await supabase
    .from("ttp_followups")
    .select("id, next_followup_at, ttp_leads!inner(id, name, phone, assigned_user_id)")
    .lte("next_followup_at", nowUTC.toISOString())
    .eq("reminder_sent", false)
    .not("next_followup_at", "is", null);

  if (followupError) {
    stats.errors.push(`followups: ${followupError.message}`);
  } else {
    for (const followup of pendingFollowups ?? []) {
      const lead = followup.ttp_leads;
      const leadName = lead?.name ?? "Lead";
      const phone = lead?.phone;
      const userId = lead?.assigned_user_id ?? null;

      const followTime = new Date(followup.next_followup_at);
      const diff = (followTime - nowUTC) / 60000;
      
      if (diff > 0) continue; // Should only process if <= 0

      const timeStr = followTime.toLocaleString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });

      // 1a. Send WhatsApp to lead (Raw text fallback)
      if (phone) {
        await sendWhatsApp(phone, `Reminder: We will call you today at ${timeStr}`);
      }

      // 1b. Insert internal notification for assigned user
      await insertNotification(
        supabase,
        userId,
        "Follow-up Reminder",
        `You have follow-up with ${leadName}`,
        "followup_reminder"
      );

      // 1c. Mark reminder as sent
      await supabase
        .from("ttp_followups")
        .update({ reminder_sent: true })
        .eq("id", followup.id);

      stats.followups++;
      console.log(`[Followup] ✅ Processed: ${leadName}`);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 2: MEETING REMINDERS (30 min / 15 min / 5 min)
  // Fetch all meetings in the next 35 minutes
  // ═══════════════════════════════════════════════════════════════════════════
  const in35Min = new Date(nowUTC.getTime() + 35 * 60 * 1000).toISOString();

  const { data: upcomingMeetings, error: meetingError } = await supabase
    .from("ttp_meetings")
    .select(
      "id, meeting_datetime, meeting_link, reminder_30_sent, reminder_15_sent, reminder_5_sent, ttp_meeting_leads(ttp_leads(id, name, phone, assigned_user_id))"
    )
    .eq("is_deleted", false)
    .gte("meeting_datetime", nowUTC.toISOString())
    .lte("meeting_datetime", in35Min);

  if (meetingError) {
    stats.errors.push(`meetings: ${meetingError.message}`);
  } else {
    for (const meeting of upcomingMeetings ?? []) {
      const meetingLeads = meeting.ttp_meeting_leads || [];
      const link = meeting.meeting_link ?? "(link not set)";

      const meetingTime = new Date(meeting.meeting_datetime);
      const diffMinutes = (meetingTime - nowUTC) / 60000;

      console.log("Meeting:", meeting.id);
      console.log("Now UTC:", nowUTC);
      console.log("Meeting Time:", meetingTime);
      console.log("Diff Minutes:", diffMinutes);
      console.log("Leads count:", meetingLeads.length);

      const timeStr = meetingTime.toLocaleString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });

      // Helper to process sending to all leads
      const sendToLeads = async (timingLabel, messageTemplate) => {
        const minutes = timingLabel.replace("min", "");
        
        for (const ml of meetingLeads) {
          const lead = ml.ttp_leads;
          if (!lead) continue;

          // Check if we already successfully sent this specific reminder to this lead
          const { data: existingNotif } = await supabase
            .from("ttp_meeting_notifications")
            .select("id")
            .eq("meeting_id", meeting.id)
            .eq("lead_id", lead.id)
            .eq("type", timingLabel)
            .eq("status", "sent")
            .limit(1);

          if (existingNotif && existingNotif.length > 0) {
            console.log(`[Meeting-${timingLabel}] Already sent to ${lead.name}, skipping.`);
            continue;
          }

          let status = 'failed';
          if (lead.phone) {
            console.log(`[WhatsApp] Sending template 'wron_successful' to: ${lead.phone}`);
            
            // Extract Date and Time from timeZone formatted string
            // timeStr format: "Tue, 24 Mar, 12:40 pm"
            const parts = timeStr.split(',');
            const meetingDate = parts[1]?.trim() || ""; // "24 Mar"
            const meetingTime = parts[2]?.trim() || ""; // "12:40 pm"
            const platform = link.includes("zoom") ? "Zoom" : "Google Meet";

            // Use the Interakt utility template wron_successful with 6 variables
            const ok = await sendWhatsApp(lead.phone, null, {
              name: "wron_successful",
              values: [
                lead.name ?? "Customer", // {{1}} Name
                "Online Workshop",       // {{2}} Course
                meetingDate,             // {{3}} Date
                meetingTime,             // {{4}} Time
                platform,                // {{5}} Platform
                link                     // {{6}} Link
              ] 
            });
            
            status = ok ? 'sent' : 'failed';
            if (!ok) console.error(`[WhatsApp] FAILED to ${lead.phone} for ${timingLabel} reminder`);
          } else {
            console.warn(`[Meeting] Skipping lead ${lead.id} — no phone number`);
          }

          // Log the attempt (or success)
          const { error: notifInsertErr } = await supabase.from("ttp_meeting_notifications").insert({
            meeting_id: meeting.id,
            lead_id: lead.id,
            type: timingLabel,
            status: status,
          });
          if (notifInsertErr) console.error(`[MeetingNotif] Insert failed: ${notifInsertErr.message}`);

          // Also insert internal notification for staff if it's the first attempt or success
          if (status === 'sent' || !(existingNotif && existingNotif.length > 0)) {
            await insertNotification(
              supabase, lead.assigned_user_id,
              `Meeting in ${timingLabel.replace('min',' Minutes')}`,
              `You have a meeting with ${lead.name} in ${timingLabel.replace('min','')} minutes`,
              "meeting_reminder"
            );
          }
        }
      };

      // ── 30-minute reminder (Window: 25 to 32 min) ──────────────────────────────
      if (diffMinutes <= 32 && diffMinutes > 25) {
        await sendToLeads('30min'); 
        if (!meeting.reminder_30_sent) {
           await supabase.from("ttp_meetings").update({ reminder_30_sent: true }).eq("id", meeting.id);
        }
        stats.meetings++;
      }

      // ── 15-minute reminder (Window: 10 to 17 min) ──────────────────────────────
      if (diffMinutes <= 17 && diffMinutes > 10) {
        await sendToLeads('15min');
        if (!meeting.reminder_15_sent) {
           await supabase.from("ttp_meetings").update({ reminder_15_sent: true }).eq("id", meeting.id);
        }
        stats.meetings++;
      }

      // ── 5-minute reminder (Window: 2 to 7 min) ─────────────────────────────────
      if (diffMinutes <= 7 && diffMinutes > 2) {
        await sendToLeads('5min');
        if (!meeting.reminder_5_sent) {
           await supabase.from("ttp_meetings").update({ reminder_5_sent: true }).eq("id", meeting.id);
        }
        stats.meetings++;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION 3: DAILY TASK NOTIFICATIONS
  // For all followups scheduled today — insert one notification per lead per day
  // ═══════════════════════════════════════════════════════════════════════════
  const { data: todayFollowups, error: dailyError } = await supabase
    .from("ttp_followups")
    .select("id, ttp_leads!inner(id, name, assigned_user_id)")
    .gte("next_followup_at", `${todayDate}T00:00:00`)
    .lt("next_followup_at", `${todayDate}T23:59:59`);

  if (dailyError) {
    stats.errors.push(`daily: ${dailyError.message}`);
  } else {
    for (const followup of todayFollowups ?? []) {
      const lead = followup.ttp_leads;
      const leadName = lead?.name ?? "Lead";
      const userId = lead?.assigned_user_id ?? null;

      // Deduplicate: skip if already sent a daily notification for this lead today
      const { data: existing } = await supabase
        .from("ttp_notifications")
        .select("id")
        .eq("type", "daily_followup")
        .eq("user_id", userId)
        .gte("created_at", `${todayDate}T00:00:00`)
        .like("message", `%${leadName}%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await insertNotification(
        supabase,
        userId,
        "Today's Follow-up",
        `You have follow-up with ${leadName} today`,
        "daily_followup"
      );

      stats.daily++;
      console.log(`[Daily] ✅ ${leadName}`);
    }
  }

  console.log(`[send-reminders] Done:`, stats);

  return new Response(JSON.stringify({ success: true, stats }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
