import React from 'react';

/** Conversation bubble. user = right-aligned rust bubble with a tail; scout = left-aligned bare text (no bubble). transcript variant boxes both. */
export function ChatBubble({ who = 'user', children, label, compact, style }) {
  const user = who === 'user';
  const base = { fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', textAlign: 'left', animation: 'rsFadeUp .35s ease both', maxWidth: '80%' };
  if (user) return (
    <div style={{ alignSelf: 'flex-end', ...base, ...style }}>
      {label && <div style={{ fontSize: 12, color: 'var(--rs-ink-6)', marginBottom: 4, textAlign: 'right' }}>{label}</div>}
      <div style={{ padding: compact ? '10px 14px' : '14px 20px', borderRadius: '18px 18px 4px 18px', background: 'var(--rs-rust)', border: '1px solid var(--rs-border-accent-soft)', fontSize: compact ? 15 : 17, lineHeight: 1.45 }}>{children}</div>
    </div>
  );
  return (
    <div style={{ alignSelf: 'flex-start', ...base, maxWidth: '85%', ...style }}>
      {label && <div style={{ fontSize: 12, color: 'var(--rs-ink-6)', marginBottom: 4 }}>{label}</div>}
      <div style={compact ? { padding: '10px 14px', borderRadius: '18px 18px 18px 4px', background: 'rgba(255,255,255,.05)', fontSize: 15, lineHeight: 1.45 } : { fontSize: 18, lineHeight: 1.5, padding: '6px 4px' }}>{children}</div>
    </div>
  );
}
