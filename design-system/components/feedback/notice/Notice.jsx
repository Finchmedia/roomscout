import React from 'react';

/** Inline notice bar. warning = amber (stale offer, expired access); success = green dot; neutral = subtle. Optional inline action rendered after the text. */
export function Notice({ tone = 'warning', children, action, style }) {
  const t = {
    warning: { bg: 'var(--rs-surface-amber-tint)', border: 'var(--rs-border-amber)', dot: 'var(--rs-amber)' },
    success: { bg: 'rgba(255,255,255,.03)', border: 'var(--rs-border-card-soft)', dot: 'var(--rs-green)' },
    neutral: { bg: 'rgba(255,255,255,.03)', border: 'var(--rs-border-card-soft)', dot: 'var(--rs-ink-6)' },
    accent: { bg: 'var(--rs-rust-faint)', border: 'rgba(255,140,90,.22)', dot: 'var(--rs-orange)' },
  }[tone];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderRadius: 12, background: t.bg, border: `1px solid ${t.border}`, fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--rs-ink)', flexWrap: 'wrap', ...style }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: t.dot, flex: 'none' }} />
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
      {action}
    </div>
  );
}
