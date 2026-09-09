import React from 'react';

/** Quiet bottom-centre note outside the conversation (e.g. pointing to prepared demo answers). */
export function Hint({ children, style }) {
  return <div role="status" style={{ display: 'inline-block', maxWidth: 560, padding: '10px 16px', borderRadius: 12, background: 'var(--rs-surface-hint)', border: '1px solid rgba(255,200,160,.2)', fontFamily: 'var(--font-sans)', fontSize: 13.5, color: 'var(--rs-ink-2)', textAlign: 'center', animation: 'rsFadeUp .3s ease both', ...style }}>{children}</div>;
}
