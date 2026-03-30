import { supabase } from './supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// LEADS
// ─────────────────────────────────────────────────────────────────────────────

export async function getLeads(statusFilter = 'all') {
  let query = supabase
    .from('ttp_leads')
    .select('*, ttp_followups(id, followup_number, next_followup_at, status, note, dismissed, is_deleted)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });

  if (statusFilter && statusFilter !== 'all') {
    query = query.eq('status', statusFilter);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createLead({ name, phone, email, city, source = 'manual' }) {
  const { data, error } = await supabase
    .from('ttp_leads')
    .insert([{ name, phone, email: email || null, city: city || null, status: 'new', source }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLeadStatus(leadId, status) {
  const { data, error } = await supabase
    .from('ttp_leads')
    .update({ status })
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Soft-delete a lead (hides from all views) */
export async function softDeleteLead(leadId) {
  const { error } = await supabase
    .from('ttp_leads')
    .update({ is_deleted: true })
    .eq('id', leadId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// FOLLOW-UPS
// ─────────────────────────────────────────────────────────────────────────────

export async function getFollowups(leadId) {
  const { data, error } = await supabase
    .from('ttp_followups')
    .select('*')
    .eq('lead_id', leadId)
    .eq('is_deleted', false)
    .order('followup_number', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addFollowup({ leadId, note, nextFollowupAt, extend = false }) {
  const existing = await getFollowups(leadId);
  if (!extend && existing.length >= 3) throw new Error('Maximum 3 follow-ups allowed per lead.');

  const followupNumber = existing.length + 1;

    const istDate = new Date(nextFollowupAt);
    const utcDate = new Date(istDate.getTime() - (5.5 * 60 * 60 * 1000)).toISOString();

    const { data, error } = await supabase
      .from('ttp_followups')
      .insert([{
        lead_id: leadId,
        followup_number: followupNumber,
        note: note || null,
        next_followup_at: utcDate,
      status: 'pending',
      reminder_sent: false,
      dismissed: false,
      is_deleted: false,
    }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Mark a followup as dismissed — it will no longer appear in today's tasks / popup. */
export async function dismissFollowup(followupId) {
  const { error } = await supabase
    .from('ttp_followups')
    .update({ dismissed: true })
    .eq('id', followupId);
  if (error) throw error;
}

/** Soft-delete a followup. */
export async function softDeleteFollowup(followupId) {
  const { error } = await supabase
    .from('ttp_followups')
    .update({ is_deleted: true })
    .eq('id', followupId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// MEETINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function getMeetings() {
  const { data, error } = await supabase
    .from('ttp_meetings')
    .select('*, ttp_meeting_leads(ttp_leads(id, name, phone))')
    .eq('is_deleted', false)
    .order('meeting_datetime', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function scheduleMeeting({ leadIds, meetingDatetime, meetingLink, hostEmail, traineeEmails, userName, userPhone }) {
  // 1. Prepare data for the edge function
  // We need IST date and 12h time format for the edge function's parser
  const dt = new Date(meetingDatetime);
  
  // Format Date as YYYY-MM-DD in IST
  const meetingDate = dt.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  
  // Format Time as HH:MM AM/PM in IST
  const meetingTime = dt.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true, 
    timeZone: 'Asia/Kolkata' 
  }).replace(/\u202f/g, ' '); // Replace narrow non-breaking space with regular space

  // 2. Invoke the edge function
  // This handles: Double-booking check, Google Meet link generation, 
  // DB insertion (ttp_meetings), and WhatsApp confirmation.
  const { data, error } = await supabase.functions.invoke('create-meeting', {
    body: {
      userName: userName || 'Lead',
      userPhone: userPhone || '',
      meetingDate,
      meetingTime,
      hostEmail: hostEmail || null,
      traineeEmails: traineeEmails || [],
      duration: 30, // Default duration
      courseName: 'Meeting', // Can be customized
      meetingLink: meetingLink || null, // pass manual link; skips Google Meet generation if set
    }
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || 'Failed to schedule meeting');

  // 3. Link additional leads to the meeting in the database
  // The edge function already linked the primary lead (userName/userPhone).
  // We link everyone else from leadIds to ensure they appear in the CRM UI.
  if (leadIds && leadIds.length > 0) {
    const meetingLeads = leadIds.map(id => ({
      meeting_id: data.meetingId,
      lead_id: id
    }));
    
    // We use a simple insert; if some are duplicates, Supabase will handle it 
    // depending on the table constraints (usually fails or we can UPSERT)
    await supabase.from('ttp_meeting_leads').insert(meetingLeads);
  }

  return data;
}

export async function addLeadsToMeeting(meetingId, leadIds) {
  if (!leadIds || leadIds.length === 0) return;
  const meetingLeads = leadIds.map(id => ({
    meeting_id: meetingId,
    lead_id: id
  }));
  const { error } = await supabase
    .from('ttp_meeting_leads')
    .insert(meetingLeads);
  if (error) throw error;
}

export async function updateMeeting({ meetingId, leadIds, meetingDatetime, meetingLink }) {
  // Converting local date-string to UTC for DB
  const utcTime = new Date(meetingDatetime).toISOString();

  // 1. Update meeting details and reset reminder flags
  const { data: meeting, error } = await supabase
    .from('ttp_meetings')
    .update({
      meeting_datetime: utcTime,
      meeting_link: meetingLink,
      reminder_30_sent: false,
      reminder_15_sent: false,
      reminder_5_sent: false,
    })
    .eq('id', meetingId)
    .select()
    .single();

  if (error) throw error;

  // 2. Refresh leads if leadIds provided
  if (leadIds) {
    // Delete existing links
    await supabase.from('ttp_meeting_leads').delete().eq('meeting_id', meetingId);
    
    // Insert new links
    if (leadIds.length > 0) {
      const meetingLeads = leadIds.map(id => ({
        meeting_id: meetingId,
        lead_id: id
      }));
      const { error: leadsError } = await supabase
        .from('ttp_meeting_leads')
        .insert(meetingLeads);
      if (leadsError) throw leadsError;
    }
  }

  return meeting;
}

export async function deleteMeeting(meetingId) {
  const { error } = await supabase
    .from('ttp_meetings')
    .update({ is_deleted: true })
    .eq('id', meetingId);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGES (WhatsApp chat history)
// ─────────────────────────────────────────────────────────────────────────────

export async function getMessages(leadId) {
  const { data, error } = await supabase
    .from('ttp_messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addMessage({ leadId, messageText, direction = 'outgoing' }) {
  const { data, error } = await supabase
    .from('ttp_messages')
    .insert([{ lead_id: leadId, text: messageText, message_text: messageText, direction }])
    .select()
    .single();
  if (error) throw error;

  // Trigger real WhatsApp delivery if it's outgoing
  if (direction === 'outgoing') {
    try {
      await supabase.functions.invoke('whatsapp-webhook', {
        body: { 
          manual: true,
          leadId: leadId,
          message: messageText
        },
        headers: {
          'x-interakt-secret': 'mysecret123'
        }
      });
    } catch (e) {
      console.error("Link to WhatsApp failed:", e);
    }
  }

  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// LEAD TIMELINE (messages + followups + activities merged)
// ─────────────────────────────────────────────────────────────────────────────

export async function getLeadTimeline(leadId) {
  const [msgsRes, followupsRes, meetingsRes, activitiesRes] = await Promise.all([
    supabase.from('ttp_messages').select('*').eq('lead_id', leadId).order('created_at', { ascending: true }),
    supabase.from('ttp_followups').select('*').eq('lead_id', leadId).eq('is_deleted', false).order('created_at', { ascending: true }),
    supabase.from('ttp_meeting_leads').select('meeting_id, ttp_meetings(*)').eq('lead_id', leadId),
    supabase.from('ttp_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: true }),
  ]);

  const items = [];

  (msgsRes.data || []).forEach(m => items.push({ ...m, _type: 'message', _at: m.created_at }));
  (followupsRes.data || []).forEach(f => items.push({ ...f, _type: 'followup', _at: f.created_at || f.next_followup_at }));
  (meetingsRes.data || []).forEach(ml => {
    if (ml.ttp_meetings && !ml.ttp_meetings.is_deleted) {
      items.push({ ...ml.ttp_meetings, _type: 'meeting', _at: ml.ttp_meetings.meeting_datetime });
    }
  });
  (activitiesRes.data || []).forEach(a => items.push({ ...a, _type: 'activity', _at: a.created_at }));

  items.sort((a, b) => new Date(a._at) - new Date(b._at));
  return items;
}

// ─────────────────────────────────────────────────────────────────────────────
// TODAY TASKS
// ─────────────────────────────────────────────────────────────────────────────

export async function getTodayTasks() {
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
  const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59).toISOString();

  const [followupsRes, meetingsRes] = await Promise.all([
    supabase
      .from('ttp_followups')
      .select('*, ttp_leads(id, name, phone)')
      .gte('next_followup_at', startOfDay)
      .lte('next_followup_at', endOfDay)
      .eq('is_deleted', false)
      .eq('dismissed', false)
      .order('next_followup_at', { ascending: true }),
    supabase
      .from('ttp_meetings')
      .select('*, ttp_meeting_leads(ttp_leads(id, name, phone))')
      .gte('meeting_datetime', startOfDay)
      .lte('meeting_datetime', endOfDay)
      .eq('is_deleted', false)
      .order('meeting_datetime', { ascending: true }),
  ]);

  if (followupsRes.error) throw followupsRes.error;
  if (meetingsRes.error) throw meetingsRes.error;

  return {
    followups: followupsRes.data || [],
    meetings: meetingsRes.data || [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function getNotifications() {
  const { data, error } = await supabase
    .from('ttp_notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data || [];
}

export async function markNotificationRead(notificationId) {
  const { error } = await supabase
    .from('ttp_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllNotificationsRead() {
  const { error } = await supabase
    .from('ttp_notifications')
    .update({ is_read: true })
    .eq('is_read', false);
  if (error) throw error;
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS
// ─────────────────────────────────────────────────────────────────────────────

export async function getSettings() {
  const { data, error } = await supabase
    .from('ttp_settings')
    .select('*')
    .eq('id', 'default')
    .single();
  if (error) throw error;
  return data;
}

export async function updateSettings(settings) {
  const { data, error } = await supabase
    .from('ttp_settings')
    .update({ ...settings, updated_at: new Date().toISOString() })
    .eq('id', 'default')
    .select()
    .single();
  if (error) throw error;
  return data;
}

