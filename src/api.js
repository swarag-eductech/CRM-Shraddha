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

export async function createLead({ name, phone, email, city, source = 'manual', lead_program = 'student_abacus_class' }) {
  const { data, error } = await supabase
    .from('ttp_leads')
    .insert([{ name, phone, email: email || null, city: city || null, status: 'new', source, lead_program }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(leadId, updates) {
  const { data, error } = await supabase
    .from('ttp_leads')
    .update(updates)
    .eq('id', leadId)
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
// LEAD POOL & CLAIM
// ─────────────────────────────────────────────────────────────────────────────

/** All unassigned leads in the pool (visible to all users) */
export async function getLeadPool() {
  const { data, error } = await supabase
    .from('ttp_leads')
    .select('*')
    .is('assigned_user_id', null)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Leads assigned to a specific user */
export async function getMyLeads(userId) {
  const { data, error } = await supabase
    .from('ttp_leads')
    .select('*, ttp_followups(id, followup_number, next_followup_at, status, note, dismissed, is_deleted)')
    .eq('assigned_user_id', userId)
    .eq('is_deleted', false)
    .order('claimed_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/**
 * Atomic claim: only succeeds if assigned_user_id IS NULL.
 * Prevents double-claiming the same lead.
 */
export async function claimLead(leadId, userId) {
  const { data, error } = await supabase
    .from('ttp_leads')
    .update({ assigned_user_id: userId, claimed_at: new Date().toISOString() })
    .eq('id', leadId)
    .is('assigned_user_id', null)
    .select()
    .single();
  if (error) throw error;
  if (!data) throw new Error('Lead already claimed by another user.');
  return data;
}

/** Admin: all leads with crm_users join for assigned user name */
export async function getLeadsForAdmin() {
  const { data, error } = await supabase
    .from('ttp_leads')
    .select('*, crm_users(id, name, email)')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Admin: reassign a lead to another user (or null to put back in pool) */
export async function reassignLead(leadId, newUserId) {
  const { data, error } = await supabase
    .from('ttp_leads')
    .update({
      assigned_user_id: newUserId || null,
      claimed_at: newUserId ? new Date().toISOString() : null,
    })
    .eq('id', leadId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// CRM USERS
// ─────────────────────────────────────────────────────────────────────────────

export async function getCRMUsers() {
  const { data, error } = await supabase
    .from('crm_users')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Upsert a crm_users record (called on login to ensure profile exists).
 *  If the user already exists, only name/email are refreshed — the admin-managed
 *  role is preserved so it is never overwritten by the login flow. */
export async function upsertCRMUser({ id, name, email, role = 'user' }) {
  // Check whether this user already has a profile row
  const { data: existing } = await supabase
    .from('crm_users')
    .select('id')
    .eq('id', id)
    .maybeSingle();

  if (existing) {
    // User exists — refresh name & email only, keep role intact
    const { data, error } = await supabase
      .from('crm_users')
      .update({ name, email })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    // New user — insert with the provided role
    const { data, error } = await supabase
      .from('crm_users')
      .insert([{ id, name, email, role }])
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function updateCRMUserRole(userId, role) {
  const { data, error } = await supabase
    .from('crm_users')
    .update({ role })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Admin: create a new auth user via the create-user Edge Function.
 * Returns { success, user } or throws on error.
 */
export async function createCRMUser({ name, email, password, role = 'user' }) {
  const { data, error } = await supabase.functions.invoke('create-user', {
    body: { name, email, password, role },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
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

  // Insert dashboard bell notification (non-fatal)
  try {
    const { data: lead } = await supabase
      .from('ttp_leads')
      .select('name, assigned_user_id')
      .eq('id', leadId)
      .single();
    const displayDate = new Date(utcDate).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata',
    });
    await supabase.from('ttp_notifications').insert({
      user_id: lead?.assigned_user_id || null,
      title: 'Follow-up Scheduled',
      message: `Follow-up #${followupNumber} for ${lead?.name || 'Lead'} scheduled for ${displayDate}`,
      type: 'followup_scheduled',
      is_read: false,
    });
  } catch (_) { /* non-fatal */ }

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

export async function scheduleMeeting({ leadIds, meetingDatetime, meetingLink, hostEmail, hostName, hostPhone, traineeEmails, userName, userPhone, meetingType, meetingProgram }) {
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
      hostName: hostName || '',
      hostPhone: hostPhone || '',
      traineeEmails: traineeEmails || [],
      duration: 30,
      courseName: 'Meeting',
      meetingLink: meetingLink || null,
      meetingType: meetingType || 'orientation',
      meetingProgram: meetingProgram || 'ttp_teacher_training',
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

