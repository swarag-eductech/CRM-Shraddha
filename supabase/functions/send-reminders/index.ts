// @ts-nocheck  — Deno runtime: URL imports and Deno.env are valid, ignore Node TS errors
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Per-type Interakt template names ────────────────────────────────────────
function templateNameForType(meetingType: string): string {
  const map: Record<string, string> = {
    orientation: "meeting_orientation_v2",
    marketing:   "meeting_marketing_v2",
    doubt:       "meeting_doubt_v2",
  };
  return map[meetingType] || "wron_successful";
}

// Language codes MUST match exactly what was approved in Interakt/Meta
// meeting_orientation_v2 → en_GB  (created as English UK)
// all others             → en     (created as English)
function templateLangForType(meetingType: string): string {
  return meetingType === "orientation" ? "en_GB" : "en";
}

// ─── WhatsApp sender via Interakt API ────────────────────────────────────────
async function sendWhatsApp(
  phone: string,
  message: string | null,
  template?: { name: string; lang?: string; values: string[] }
): Promise<boolean> {
  const apiKey = Deno.env.get("INTERAKT_API_KEY");

  if (!apiKey) {
    console.warn(`[WhatsApp] INTERAKT_API_KEY not set — would send to ${phone}: ${message || template?.name}`);
    return false;
  }

  const digits = phone.replace(/\D/g, "");
  const formattedPhone = digits.startsWith("91") && digits.length === 12
    ? digits.slice(2)
    : digits;

  console.log(`[WhatsApp] Sending to: ${formattedPhone} (Template: ${template?.name ?? "None"})`);

  const authHeader = `Basic ${apiKey}`;

  try {
    const body: any = {
      countryCode: "+91",
      phoneNumber: formattedPhone,
      callbackData: "CRM",
      type: "Template",
      template: {
        name: template?.name ?? "wron_successful",
        languageCode: template?.lang ?? "en",
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
      console.error(`[WhatsApp] ❌ Failed for ${formattedPhone} (${res.status}): ${responseText} | Template: ${body.template.name}`);
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
  const todayDate = nowUTC.toISOString().split("T")[0];

  const stats = { followups: 0, meetings: 0, daily: 0, errors: [] as string[] };

  // ── SECTION 1: FOLLOW-UP REMINDERS ──────────────────────────────────────────
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
      const diff = (followTime.getTime() - nowUTC.getTime()) / 60000;
      if (diff > 0) continue;

      const timeStr = followTime.toLocaleString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      });

      if (phone) {
        await sendWhatsApp(phone, `Reminder: We will call you today at ${timeStr}`);
      }

      await insertNotification(supabase, userId, "Follow-up Reminder", `You have follow-up with ${leadName}`, "followup_reminder");

      await supabase.from("ttp_followups").update({ reminder_sent: true }).eq("id", followup.id);

      stats.followups++;
      console.log(`[Followup] ✅ Processed: ${leadName}`);
    }
  }

  // ── SECTION 2: MEETING REMINDERS ────────────────────────────────────────────

  // IST helpers for day-based calculations
  const ISTOffsetMs = 5.5 * 60 * 60 * 1000;
  const nowIST = new Date(nowUTC.getTime() + ISTOffsetMs);
  const getISTDateAhead = (n: number): string => {
    const d = new Date(nowIST.getTime() + n * 24 * 60 * 60 * 1000);
    return d.toISOString().split("T")[0]; // YYYY-MM-DD in IST
  };

  // Shared helper: dispatch WhatsApp + in-app notification to all leads of a meeting
  const dispatchMeetingReminder = async (
    label: string,
    meetingId: string,
    meetingLeads: any[],
    linkValue: string,
    timeStr: string,
    meetingType = 'orientation'
  ) => {
    for (const ml of meetingLeads) {
      const lead = ml.ttp_leads;
      if (!lead) continue;

      const { data: existingNotif } = await supabase
        .from("ttp_meeting_notifications")
        .select("id")
        .eq("meeting_id", meetingId)
        .eq("lead_id", lead.id)
        .eq("type", label)
        .limit(1);

      if (existingNotif && existingNotif.length > 0) {
        console.log(`[Meeting-${label}] Already attempted for ${lead.name}, skipping.`);
        continue;
      }

      let status = "failed";
      if (lead.phone) {
        console.log(`[WhatsApp] Sending '${label}' reminder to: ${lead.phone}`);
        const parts = timeStr.split(",");
        const meetingDate = parts[1]?.trim() || "";
        const meetingTimeStr = parts[2]?.trim() || "";
        const platform = linkValue?.includes("zoom") ? "Zoom" : "Google Meet";

        const ok = await sendWhatsApp(lead.phone, null, {
          name: templateNameForType(meetingType),
          lang: templateLangForType(meetingType),
          values: [
            lead.name ?? "Customer", // {{1}} Name
            "Online Workshop",       // {{2}} Course
            meetingDate,             // {{3}} Date
            meetingTimeStr,          // {{4}} Time
            platform,                // {{5}} Platform
            linkValue,               // {{6}} Meeting Link
          ],
        });
        status = ok ? "sent" : "failed";
        if (!ok) console.error(`[WhatsApp] FAILED to ${lead.phone} for ${label} reminder`);
      } else {
        console.warn(`[Meeting] Skipping lead ${lead.id} — no phone number`);
      }

      const { error: notifInsertErr } = await supabase.from("ttp_meeting_notifications").insert({
        meeting_id: meetingId,
        lead_id: lead.id,
        type: label,
        status,
      });
      if (notifInsertErr) console.error(`[MeetingNotif] Insert failed: ${notifInsertErr.message}`);

      const friendlyLabel =
        label === "3day"  ? "3 Days"   :
        label === "2day"  ? "2 Days"   :
        label === "1day"  ? "1 Day"    :
        label === "1hour" ? "1 Hour"   :
        label.replace("min", " Minutes");

      await insertNotification(
        supabase,
        lead.assigned_user_id,
        `Meeting Reminder – ${friendlyLabel} to go`,
        `You have a meeting with ${lead.name} in ${friendlyLabel}`,
        "meeting_reminder"
      );
    }
  };

  // ── 2A: Day-based reminders: 3 days / 2 days / 1 day before ─────────────────
  const dayReminderConfig = [
    { daysAhead: 3, flag: "reminder_3day_sent",  label: "3day" },
    { daysAhead: 2, flag: "reminder_2day_sent",  label: "2day" },
    { daysAhead: 1, flag: "reminder_1day_sent",  label: "1day" },
  ];

  for (const { daysAhead, flag, label } of dayReminderConfig) {
    const targetDate = getISTDateAhead(daysAhead);
    const rangeStart = `${targetDate}T00:00:00+05:30`;
    const rangeEnd   = `${targetDate}T23:59:59+05:30`;

    const { data: dayMeetings, error: dayErr } = await supabase
      .from("ttp_meetings")
      .select("id, meeting_datetime, meeting_link, meeting_type, ttp_meeting_leads(ttp_leads(id, name, phone, assigned_user_id))")
      .eq("is_deleted", false)
      .eq(flag, false)
      .gte("meeting_datetime", rangeStart)
      .lte("meeting_datetime", rangeEnd);

    if (dayErr) {
      stats.errors.push(`${label}: ${dayErr.message}`);
      continue;
    }

    for (const meeting of dayMeetings ?? []) {
      const meetingLeads = meeting.ttp_meeting_leads || [];
      let linkValue = meeting.meeting_link;
      if (!linkValue || String(linkValue) === "null" || String(linkValue).trim() === "") {
        linkValue = "https://meet.google.com/new";
      }

      const meetTime = new Date(meeting.meeting_datetime);
      const timeStr = meetTime.toLocaleString("en-IN", {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
      });

      await dispatchMeetingReminder(label, meeting.id, meetingLeads, linkValue, timeStr, meeting.meeting_type || 'orientation');
      await supabase.from("ttp_meetings").update({ [flag]: true }).eq("id", meeting.id);
      stats.meetings++;
      console.log(`[Meeting-${label}] ✅ Reminders dispatched for meeting ${meeting.id}`);
    }
  }

  // ── 2B: Time-based reminders: 1 hour / 30 min / 15 min / 5 min before ────────
  const in65Min = new Date(nowUTC.getTime() + 65 * 60 * 1000).toISOString();

  const { data: upcomingMeetings, error: meetingError } = await supabase
    .from("ttp_meetings")
    .select("id, meeting_datetime, meeting_link, meeting_type, reminder_1hour_sent, reminder_30_sent, reminder_15_sent, reminder_5_sent, ttp_meeting_leads(ttp_leads(id, name, phone, assigned_user_id))")
    .eq("is_deleted", false)
    .gte("meeting_datetime", nowUTC.toISOString())
    .lte("meeting_datetime", in65Min);

  if (meetingError) {
    stats.errors.push(`meetings: ${meetingError.message}`);
  } else {
    for (const meeting of upcomingMeetings ?? []) {
      const meetingLeads = meeting.ttp_meeting_leads || [];
      let linkValue = meeting.meeting_link;

      if (!linkValue || String(linkValue) === "null" || String(linkValue).trim() === "") {
        console.warn(`[Meeting] ⚠️ meeting_link missing for ${meeting.id}. Using fallback.`);
        linkValue = "https://meet.google.com/new";
      }

      const meetTime = new Date(meeting.meeting_datetime);
      const diffMinutes = (meetTime.getTime() - nowUTC.getTime()) / 60000;

      console.log(`Meeting: ${meeting.id} | Diff: ${diffMinutes.toFixed(1)} min | Leads: ${meetingLeads.length}`);

      const timeStr = meetTime.toLocaleString("en-IN", {
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
      });

      if (diffMinutes <= 62 && diffMinutes > 55) {
        await dispatchMeetingReminder("1hour", meeting.id, meetingLeads, linkValue, timeStr, meeting.meeting_type || 'orientation');
        if (!meeting.reminder_1hour_sent) await supabase.from("ttp_meetings").update({ reminder_1hour_sent: true }).eq("id", meeting.id);
        stats.meetings++;
      }
      if (diffMinutes <= 32 && diffMinutes > 25) {
        await dispatchMeetingReminder("30min", meeting.id, meetingLeads, linkValue, timeStr, meeting.meeting_type || 'orientation');
        if (!meeting.reminder_30_sent) await supabase.from("ttp_meetings").update({ reminder_30_sent: true }).eq("id", meeting.id);
        stats.meetings++;
      }
      if (diffMinutes <= 17 && diffMinutes > 10) {
        await dispatchMeetingReminder("15min", meeting.id, meetingLeads, linkValue, timeStr, meeting.meeting_type || 'orientation');
        if (!meeting.reminder_15_sent) await supabase.from("ttp_meetings").update({ reminder_15_sent: true }).eq("id", meeting.id);
        stats.meetings++;
      }
      if (diffMinutes <= 7 && diffMinutes > 2) {
        await dispatchMeetingReminder("5min", meeting.id, meetingLeads, linkValue, timeStr, meeting.meeting_type || 'orientation');
        if (!meeting.reminder_5_sent) await supabase.from("ttp_meetings").update({ reminder_5_sent: true }).eq("id", meeting.id);
        stats.meetings++;
      }
    }
  }

  // ── SECTION 3: DAILY TASK NOTIFICATIONS ─────────────────────────────────────
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

      const { data: existing } = await supabase
        .from("ttp_notifications")
        .select("id")
        .eq("type", "daily_followup")
        .eq("user_id", userId)
        .gte("created_at", `${todayDate}T00:00:00`)
        .like("message", `%${leadName}%`)
        .limit(1);

      if (existing && existing.length > 0) continue;

      await insertNotification(supabase, userId, "Today's Follow-up", `You have follow-up with ${leadName} today`, "daily_followup");

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
