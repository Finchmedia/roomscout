import React from 'react';

const C = { accent: 'var(--rs-orange)', success: 'var(--rs-green)', warning: 'var(--rs-amber)', muted: 'var(--rs-ink-6)', neutral: 'var(--rs-ink-2)' };

/** Colored dot + short status text. Used for "Scout ist unterwegs", source status, integration health. pulse = slow opacity blink. */
export function StatusDot({ tone = 'accent', pulse, children, size = 8, style, ...rest }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, fontFamily: 'var(--font-sans)', fontSize: 14.5, color: 'var(--rs-ink-2)', whiteSpace: 'nowrap', ...style }} {...rest}>
      <span style={{ width: size, height: size, borderRadius: '50%', background: C[tone] || tone, flex: 'none', animation: pulse ? 'rsDot 2.4s ease-in-out infinite' : 'none' }} />
      {children}
    </span>
  );
}
