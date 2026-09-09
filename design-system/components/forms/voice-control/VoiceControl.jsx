import React from 'react';

/** Large labelled circular control for the live conversation (Mikro an/aus · Mitschrift · Gespräch beenden). */
export function VoiceControl({ tone = 'neutral', size = 76, label, children, active, onClick, style }) {
  const [h, setH] = React.useState(false);
  const circle = {
    neutral: { background: h ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.07)', border: '1px solid var(--rs-border-panel)', color: 'var(--rs-ink)' },
    accent: { background: active === false ? 'rgba(255,255,255,.07)' : (h ? 'var(--rs-orange-hover)' : 'var(--rs-orange)'), border: active === false ? '1px solid var(--rs-border-panel)' : '1px solid transparent', color: '#fff', boxShadow: active === false ? 'none' : '0 0 0 6px rgba(255,105,38,.12)' },
    danger: { background: h ? 'var(--rs-red-hover)' : 'var(--rs-red)', border: 0, color: '#fff' },
  }[tone];
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, border: 0, background: 'none', color: 'var(--rs-ink-2)', fontFamily: 'var(--font-sans)', fontSize: 14, cursor: 'pointer', padding: 0, ...style }}>
      <span style={{ width: size, height: size, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background .3s', ...circle }}>{children}</span>
      {label}
    </button>
  );
}
