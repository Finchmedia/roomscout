import React from 'react';

/** Profile dropdown anchored under the avatar. items: [{label, icon, onClick}]. */
export function ProfileMenu({ name = 'Herzbuben', subtitle = 'Persönlicher Bereich', items = [], style }) {
  const [h, setH] = React.useState(null);
  return (
    <div role="menu" style={{ minWidth: 240, padding: 8, borderRadius: 16, background: 'var(--rs-surface-menu)', border: '1px solid var(--rs-border-panel)', boxShadow: 'var(--shadow-menu)', display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', animation: 'rsFadeUp .18s ease both', ...style }}>
      <div style={{ padding: '10px 12px 8px' }}><div style={{ fontSize: 15, fontWeight: 500 }}>{name}</div><div style={{ fontSize: 12.5, color: 'var(--rs-ink-6)' }}>{subtitle}</div></div>
      <div style={{ height: 1, background: 'var(--rs-border-divider)', margin: '2px 4px 6px' }} />
      {items.map((it, i) => (
        <button key={i} role="menuitem" onClick={it.onClick} onMouseEnter={() => setH(i)} onMouseLeave={() => setH(null)} style={{ textAlign: 'left', border: 0, background: h === i ? 'var(--rs-surface-hover-soft)' : 'none', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 15, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}>{it.icon}{it.label}</button>
      ))}
    </div>
  );
}
