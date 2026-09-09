import React from 'react';

/** FAQ-style accordion item: question row with a circled +/− toggle; the answer slides via grid-template-rows. */
export function Accordion({ question, children, defaultOpen = false, style }) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div style={{ borderRadius: 18, border: `1px solid ${open ? 'var(--rs-border-accent-faint)' : 'var(--rs-border-card)'}`, background: 'var(--rs-surface-card-faint)', transition: 'border-color .3s', fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', ...style }}>
      <button onClick={() => setOpen(o => !o)} aria-expanded={open} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 20, padding: '22px 26px', border: 0, background: 'none', color: 'inherit', fontFamily: 'inherit', fontSize: 'clamp(18px,1.5vw,22px)', textAlign: 'left', cursor: 'pointer', borderRadius: 18 }}>
        <span>{question}</span>
        <span style={{ width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--rs-border-control-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', transition: 'transform .3s', transform: open ? 'rotate(180deg)' : 'none' }}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="M12 5v14" style={{ opacity: open ? 0 : 1, transition: 'opacity .2s' }} /></svg></span>
      </button>
      <div style={{ display: 'grid', gridTemplateRows: open ? '1fr' : '0fr', transition: 'grid-template-rows .32s cubic-bezier(.3,.7,.2,1)' }}><div style={{ overflow: 'hidden', minHeight: 0 }}><div style={{ padding: '0 26px 24px', fontSize: 16, lineHeight: 1.6, color: 'var(--rs-ink-4)' }}>{children}</div></div></div>
    </div>
  );
}
