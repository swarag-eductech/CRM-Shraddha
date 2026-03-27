import React, { useState, useEffect, useCallback } from 'react';
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { MdRefresh, MdTrendingUp, MdCheckCircle, MdPeople, MdEvent } from 'react-icons/md';
import { supabase } from '../supabaseClient';

// ─── palette ──────────────────────────────────────────────────────────────────
const STATUS_COLORS = {
  new:       '#3b82f6',
  contacted: '#8b5cf6',
  warm:      '#f59e0b',
  converted: '#10b981',
  lost:      '#ef4444',
  dead:      '#6b7280',
};
const PIE_COLORS = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#6b7280'];
const BAR_COLOR = '#ff6600';

// ─── helpers ──────────────────────────────────────────────────────────────────
function monthLabel(iso) {
  return new Date(iso).toLocaleString('en-IN', { month: 'short', year: '2-digit' });
}

function groupByMonth(items, dateField) {
  const counts = {};
  items.forEach((item) => {
    if (!item[dateField]) return;
    const label = monthLabel(item[dateField]);
    counts[label] = (counts[label] || 0) + 1;
  });
  // Sort chronologically (last 6 months)
  return Object.entries(counts)
    .map(([month, count]) => ({ month, count }))
    .slice(-6);
}

// ─── sub-components ───────────────────────────────────────────────────────────
function StatCard({ icon, label, value, sub, color }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 24px',
      border: '1.5px solid rgba(0,0,0,0.06)', flex: 1, minWidth: 0,
      display: 'flex', alignItems: 'center', gap: 16,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: 14, flexShrink: 0,
        background: `${color}18`, color, fontSize: 24,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#1a1a1a' }}>{value}</div>
        <div style={{ fontSize: 13, color: '#1a1a1a', fontWeight: 600 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  );
}

function ChartCard({ title, sub, children, loading }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, padding: '20px 24px',
      border: '1.5px solid rgba(0,0,0,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    }}>
      <div style={{ marginBottom: 18 }}>
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800 }}>{title}</h3>
        {sub && <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{sub}</p>}
      </div>
      {loading ? (
        <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
          Loading…
        </div>
      ) : children}
    </div>
  );
}

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }) => {
  if (percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text x={x} y={y} fill="#fff" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
};

// ─── main page ────────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [leads, setLeads] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [lr, fr, mr] = await Promise.all([
      supabase.from('ttp_leads').select('id, status, created_at, city'),
      supabase.from('ttp_followups').select('id, status, created_at, next_followup_at'),
      supabase.from('ttp_meetings').select('id, created_at, meeting_datetime'),
    ]);
    setLoading(false);
    if (!lr.error) setLeads(lr.data || []);
    if (!fr.error) setFollowups(fr.data || []);
    if (!mr.error) setMeetings(mr.data || []);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── derived data ─────────────────────────────────────────────────────────────
  const total = leads.length;
  const converted = leads.filter((l) => l.status === 'converted').length;
  const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0.0';

  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const endToday   = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);
  const todayFollowups = followups.filter((f) => {
    const d = f.next_followup_at ? new Date(f.next_followup_at) : null;
    return d && d >= startToday && d <= endToday;
  }).length;
  const todayMeetings = meetings.filter((m) => {
    const d = m.meeting_datetime ? new Date(m.meeting_datetime) : null;
    return d && d >= startToday && d <= endToday;
  }).length;

  // Pie: lead status distribution
  const statusCounts = {};
  leads.forEach((l) => {
    const s = l.status || 'new';
    statusCounts[s] = (statusCounts[s] || 0) + 1;
  });
  const pieData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

  // Bar: monthly lead growth
  const monthlyLeads = groupByMonth(leads, 'created_at');

  // Followup performance: completed vs pending
  const fCompleted = followups.filter((f) => f.status === 'completed' || f.status === 'done').length;
  const fPending   = followups.filter((f) => f.status === 'pending' || !f.status).length;
  const followupPerfData = [
    { name: 'Completed', count: fCompleted },
    { name: 'Pending',   count: fPending },
  ];

  // City distribution bar
  const cityCounts = {};
  leads.forEach((l) => { if (l.city) { cityCounts[l.city] = (cityCounts[l.city] || 0) + 1; } });
  const cityData = Object.entries(cityCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7)
    .map(([city, count]) => ({ city, count }));

  return (
    <div>
      {/* Top controls */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
        <button className="btn btn-secondary btn-sm" onClick={fetchAll} disabled={loading}>
          <MdRefresh /> Refresh
        </button>
      </div>

      {/* Stat cards row */}
      <div style={{ display: 'flex', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
        <StatCard icon={<MdPeople />}      label="Total Leads"      value={loading ? '—' : total}       sub="All time"                         color="#3b82f6" />
        <StatCard icon={<MdCheckCircle />} label="Converted"        value={loading ? '—' : converted}   sub={`${conversionRate}% rate`}        color="#10b981" />
        <StatCard icon={<MdTrendingUp />}  label="Today's Follow-ups" value={loading ? '—' : todayFollowups} sub="Pending today"            color="#f59e0b" />
        <StatCard icon={<MdEvent />}       label="Today's Meetings"  value={loading ? '—' : todayMeetings}  sub="Scheduled today"           color="#8b5cf6" />
      </div>

      {/* Charts row 1: Pie + Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16, marginBottom: 16 }} className="chart-row-1">
        <style>{`@media(max-width:800px){.chart-row-1,.chart-row-2{grid-template-columns:1fr!important}}`}</style>

        {/* Pie: Lead Status */}
        <ChartCard title="Lead Status" sub="Distribution by status" loading={loading}>
          {pieData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={pieData} cx="50%" cy="50%" outerRadius={80}
                    dataKey="value" labelLine={false} label={renderCustomLabel}
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, n]} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', marginTop: 8, justifyContent: 'center' }}>
                {pieData.map((entry, i) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 3, background: STATUS_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length], flexShrink: 0 }} />
                    <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>{entry.name}</span>
                    <span style={{ fontWeight: 700, color: '#1a1a1a' }}>{entry.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </ChartCard>

        {/* Bar: Monthly Lead Growth */}
        <ChartCard title="Monthly Lead Growth" sub="New leads per month (last 6 months)" loading={loading}>
          {monthlyLeads.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={monthlyLeads} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }}
                  cursor={{ fill: 'rgba(255,102,0,0.06)' }}
                />
                <Bar dataKey="count" name="Leads" fill={BAR_COLOR} radius={[6, 6, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Charts row 2: Followup perf + City + Conversion */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 16 }} className="chart-row-2">

        {/* Followup Performance */}
        <ChartCard title="Follow-up Performance" sub="Completed vs Pending" loading={loading}>
          {followups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No follow-ups yet</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={150}>
                <BarChart data={followupPerfData} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 12, fill: '#1a1a1a', fontWeight: 600 }} axisLine={false} tickLine={false} width={72} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }} />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={28}>
                    {followupPerfData.map((entry) => (
                      <Cell key={entry.name} fill={entry.name === 'Completed' ? '#10b981' : '#f59e0b'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              {/* Conversion rate card */}
              <div style={{
                marginTop: 20, background: 'linear-gradient(135deg, #ff6600, #f7971e)',
                borderRadius: 12, padding: '14px 18px', color: '#fff', textAlign: 'center',
              }}>
                <div style={{ fontSize: 32, fontWeight: 800 }}>{conversionRate}%</div>
                <div style={{ fontSize: 13, opacity: 0.9 }}>Overall Conversion Rate</div>
                <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{converted} of {total} leads converted</div>
              </div>
            </>
          )}
        </ChartCard>

        {/* Leads by City */}
        <ChartCard title="Leads by City" sub="Top 7 cities" loading={loading}>
          {cityData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No city data</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={cityData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                <XAxis dataKey="city" tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#999' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid rgba(0,0,0,0.08)', fontSize: 12 }} cursor={{ fill: 'rgba(139,92,246,0.06)' }} />
                <Bar dataKey="count" name="Leads" fill="#8b5cf6" radius={[6, 6, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
