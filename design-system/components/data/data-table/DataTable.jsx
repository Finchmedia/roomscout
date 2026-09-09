import React from 'react';

/** Light operator table: muted header row, hairline dividers, no zebra. columns: [{key, label, width}] ; rows: array of objects (values may be React nodes). */
export function DataTable({ columns = [], rows = [], style }) {
  const cols = columns.map(c => c.width || '1fr').join(' ');
  return (
    <div style={{ fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', ...style }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, padding: '10px 14px', fontSize: 14, color: 'var(--rs-ink-6)', borderBottom: '1px solid var(--rs-border-divider)' }}>{columns.map(c => <span key={c.key}>{c.label}</span>)}</div>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: cols, gap: 12, alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--rs-border-divider-soft)', fontSize: 16, background: r._highlight ? 'rgba(224,161,58,.06)' : 'none', borderRadius: 10 }}>{columns.map(c => <span key={c.key} style={{ color: c.muted ? 'var(--rs-ink-4)' : 'inherit' }}>{r[c.key]}</span>)}</div>
      ))}
    </div>
  );
}
