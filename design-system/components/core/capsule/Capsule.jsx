import React from 'react';

/** Extracted-fact capsule: appears under the current utterance, then glides into the fact list. Orange tint, warm text. */
export function Capsule({ children, size = 'md', style, ...rest }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height: size === 'sm' ? 30 : 34, padding: size === 'sm' ? '0 12px' : '0 14px', borderRadius: 999, background: 'var(--rs-surface-accent-tint)', border: '1px solid var(--rs-border-accent)', color: 'var(--rs-orange-tint)', fontFamily: 'var(--font-sans)', fontSize: size === 'sm' ? 13 : 14, fontWeight: 500, whiteSpace: 'nowrap', animation: 'rsFadeUp .3s ease both', ...style }} {...rest}>{children}</span>;
}
