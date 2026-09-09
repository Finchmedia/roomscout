import React from 'react';

/** Circular icon button. outline = header controls (42px); subtle = filled rgba white; accent = orange (voice entry); bare = no background. */
export function IconButton({ variant = 'outline', size = 42, children, label, style, ...rest }) {
  const [h, setH] = React.useState(false);
  const v = {
    outline: { background: h ? 'var(--rs-surface-hover)' : 'var(--rs-surface-subtle)', border: '1px solid var(--rs-border-control)', color: 'var(--rs-ink)' },
    subtle: { background: h ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.08)', border: 0, color: 'var(--rs-ink)' },
    accent: { background: h ? 'var(--rs-orange-hover)' : 'var(--rs-orange)', border: 0, color: '#fff' },
    bare: { background: h ? 'rgba(255,255,255,.08)' : 'none', border: 0, color: 'var(--rs-ink-2)' },
    danger: { background: h ? 'var(--rs-red-hover)' : 'var(--rs-red)', border: 0, color: '#fff' },
  }[variant];
  return (
    <button aria-label={label} title={label} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ width: size, height: size, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer', fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, transition: 'background .2s', flex: 'none', ...v, ...style }} {...rest}>{children}</button>
  );
}
