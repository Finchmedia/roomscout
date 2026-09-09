import React from 'react';

/** Small label tag. solid = orange ("Mein Vorschlag"); outline = accent outline uppercase ("INTERN"); muted = neutral outline ("In dieser Demo nicht aktiv"). */
export function Badge({ variant = 'solid', children, style, ...rest }) {
  const v = {
    solid: { padding: '5px 11px', borderRadius: 999, background: 'var(--rs-orange)', color: '#fff', fontSize: 12.5, fontWeight: 600, letterSpacing: '.04em' },
    outline: { padding: '5px 10px', borderRadius: 8, border: '1px solid rgba(255,140,90,.6)', color: 'var(--rs-orange-light)', fontSize: 12, letterSpacing: '.12em', fontWeight: 600, textTransform: 'uppercase' },
    muted: { padding: '4px 10px', borderRadius: 999, border: '1px solid var(--rs-border-panel)', color: 'var(--rs-ink-6)', fontSize: 13 },
    pill: { height: 38, padding: '0 18px', borderRadius: 999, border: '1px solid rgba(255,140,90,.55)', color: 'var(--rs-ink)', fontSize: 14.5 },
  }[variant];
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap', ...v, ...style }} {...rest}>{children}</span>;
}
