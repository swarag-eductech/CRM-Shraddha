import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { 
  MdEvent, MdPeople, MdSchool, MdArrowBack, MdCheckCircle, 
  MdOutlineAccessTime, MdOutlineTimer, MdCalendarToday 
} from 'react-icons/md';
import { Link } from 'react-router-dom';

export default function AdminDashboard() {
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  
  const [form, setForm] = useState({
    meetingDate: '',
    meetingTime: '',
    duration: 30,
    hostEmail: '',
    traineeEmails: []
  });

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ttp_leads')
      .select('id, name, email, phone')
      .order('name');
    
    if (error) {
      console.error(error);
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  };

  const handleTraineeToggle = (email) => {
    setForm(f => {
      if (f.traineeEmails.includes(email)) {
        return { ...f, traineeEmails: f.traineeEmails.filter(e => e !== email) };
      }
      return { ...f, traineeEmails: [...f.traineeEmails, email] };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.hostEmail || !form.meetingDate || !form.meetingTime) {
      setMessage({ type: 'error', text: 'All required fields must be filled.' });
      return;
    }

    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      // Find the host name for the userName field
      const hostUser = leads.find(l => l.email === form.hostEmail);
      
      const { data, error } = await supabase.functions.invoke('create-meeting', {
        body: {
          userName: "Admin", // Admin creating the meeting
          userPhone: "0000000000",
          meetingDate: form.meetingDate,
          meetingTime: form.meetingTime,
          duration: Number(form.duration),
          hostEmail: form.hostEmail,
          traineeEmails: form.traineeEmails
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      setMessage({ type: 'success', text: 'Meeting scheduled successfully!' });
      setForm({
        meetingDate: '',
        meetingTime: '',
        duration: 30,
        hostEmail: '',
        traineeEmails: []
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: 800 }}>Admin Meeting Control</h2>
          <p>Manage hosts and trainees for upcoming sessions</p>
        </div>
        <Link to="/" className="btn btn-secondary btn-sm">
          <MdArrowBack /> Back to CRM
        </Link>
      </div>

      {message.text && (
        <div style={{
          background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
          border: `1px solid ${message.type === 'error' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(16, 185, 129, 0.2)'}`,
          borderRadius: 12,
          padding: '12px 20px',
          marginBottom: 20,
          color: message.type === 'error' ? 'var(--red)' : 'var(--green)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 14,
          fontWeight: 600,
          animation: 'fadeInUp 0.3s ease'
        }}>
          {message.type === 'error' ? <MdEvent size={20} /> : <MdCheckCircle size={20} />}
          {message.text}
        </div>
      )}

      <div className="dashboard-grid">
        <div className="content-card">
          <h3>Schedule New Meeting</h3>
          <form onSubmit={handleSubmit} style={{ marginTop: 24 }}>
            <div className="form-grid" style={{ marginBottom: 24 }}>
              <div className="form-group">
                <label><MdCalendarToday style={{verticalAlign: 'middle', marginRight: 4}} /> Meeting Date *</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={form.meetingDate}
                  onChange={(e) => setForm(f => ({ ...f, meetingDate: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label><MdOutlineAccessTime style={{verticalAlign: 'middle', marginRight: 4}} /> Start Time (HH:MM AM/PM) *</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., 02:30 PM"
                  value={form.meetingTime}
                  onChange={(e) => setForm(f => ({ ...f, meetingTime: e.target.value }))}
                  required
                />
              </div>
              <div className="form-group">
                <label><MdOutlineTimer style={{verticalAlign: 'middle', marginRight: 4}} /> Duration (minutes)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  value={form.duration}
                  onChange={(e) => setForm(f => ({ ...f, duration: e.target.value }))}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label><MdSchool style={{verticalAlign: 'middle', marginRight: 4}} /> Select Host (Teacher) *</label>
              <select 
                className="filter-select" 
                style={{ width: '100%', paddingLeft: 14 }}
                value={form.hostEmail}
                onChange={(e) => setForm(f => ({ ...f, hostEmail: e.target.value }))}
                required
              >
                <option value="">-- Choose Host Email --</option>
                {leads.filter(l => l.email).map(l => (
                  <option key={l.id} value={l.email}>{l.name} ({l.email})</option>
                ))}
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 24 }}>
              <label><MdPeople style={{verticalAlign: 'middle', marginRight: 4}} /> Select Trainee Teachers</label>
              <div className="glass" style={{ 
                maxHeight: 300, 
                overflowY: 'auto', 
                padding: 16, 
                borderRadius: 12,
                marginTop: 8
              }}>
                {loading ? (
                  <p>Loading participants...</p>
                ) : leads.filter(l => l.email && l.email !== form.hostEmail).length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No other leads available with emails.</p>
                ) : (
                  leads.filter(l => l.email && l.email !== form.hostEmail).map(l => (
                    <label key={l.id} style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      padding: '8px 4px', 
                      cursor: 'pointer',
                      borderBottom: '1px solid rgba(0,0,0,0.05)',
                      fontSize: 14
                    }}>
                      <input 
                        type="checkbox" 
                        checked={form.traineeEmails.includes(l.email)}
                        onChange={() => handleTraineeToggle(l.email)}
                        style={{ marginRight: 12, width: 18, height: 18, accentColor: 'var(--primary)' }}
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 600 }}>{l.name}</span>
                        <small style={{ color: 'var(--text-muted)' }}>{l.email}</small>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', height: 48, justifyContent: 'center' }}
              disabled={saving || loading}
            >
              <MdEvent size={20} /> {saving ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </form>
        </div>

        <div className="content-card">
          <h3>Recent Sync Info</h3>
          <div style={{ marginTop: 20 }}>
            <p style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--text-muted)' }}>
              Scheduled meetings are automatically added to the Google Calendar of the <strong>Host</strong> and 
              all <strong>Trainees</strong>.
            </p>
            <div style={{ 
              marginTop: 20, padding: 16, background: 'var(--bg-light)', 
              borderRadius: 12, border: '1px dashed var(--border)' 
            }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
                SUMMARY PREVIEW
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                <div><strong>Host:</strong> {form.hostEmail || 'Not selected'}</div>
                <div><strong>Participants:</strong> {form.traineeEmails.length}</div>
                <div><strong>Platform:</strong> Google Meet (Auto-generated)</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
