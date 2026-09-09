import React from 'react';

/** Event notification with a primary action ("Zum Scout") and dismiss. Appears top-right while another area is open. */
export function Toast({ children, actionLabel = 'Zum Scout', onAction, onDismiss, style }) {
  const [h, setH] = React.useState(false);
  return (
    <div role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 14, padding: '12px 12px 12px 16px', borderRadius: 14, background: 'var(--rs-surface-toast)', border: '1px solid var(--rs-border-accent-soft)', boxShadow: 'var(--shadow-toast)', fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', animation: 'rsFadeUp .25s ease both', ...style }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--rs-orange)', flex: 'none' }} />
      <span style={{ fontSize: 14.5 }}>{children}</span>
      {onAction && <button onClick={onAction} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ height: 34, padding: '0 14px', borderRadius: 999, border: 0, background: h ? 'var(--rs-orange-hover)' : 'var(--rs-orange)', color: '#fff', fontFamily: 'inherit', fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>{actionLabel}</button>}
      {onDismiss && <button onClick={onDismiss} aria-label="Schließen" style={{ width: 30, height: 30, borderRadius: '50%', border: 0, background: 'none', color: 'var(--rs-ink-6)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg></button>}
    </div>
  );
}
