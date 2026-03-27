import React from 'react';

export const SOURCE_CONFIG = {
  landing_page: { label: '🌐 Landing',   bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe' },
  website:      { label: '💻 Website',   bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' },
  intrakt:      { label: '💬 WhatsApp',  bg: '#fdf4ff', color: '#7c3aed', border: '#e9d5ff' },
  whatsapp:     { label: '💬 WhatsApp',  bg: '#fdf4ff', color: '#7c3aed', border: '#e9d5ff' },
  manual:       { label: '✏️ Manual',    bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' },
};

export function SourceBadge({ source }) {
  if (!source) return null;
  const cfg = SOURCE_CONFIG[source] || {
    label: source.charAt(0).toUpperCase() + source.slice(1),
    bg: '#f9fafb', color: '#6b7280', border: '#e5e7eb',
  };
  return (
    <span style={{
      background: cfg.bg,
      color: cfg.color,
      border: `1.5px solid ${cfg.border}`,
      padding: '2px 9px',
      borderRadius: 20,
      fontSize: 10,
      fontWeight: 700,
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}>
      {cfg.label}
    </span>
  );
}
