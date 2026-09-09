import React from 'react';

/** Large radio option rendered as a card (Autopilot / Mit Rücksprache). */
export function RadioCard({ checked, onSelect, title, description, style, ...rest }) {
  return (
    <button role="radio" aria-checked={!!checked} onClick={onSelect} style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '20px 22px', borderRadius: 16, border: `1px solid ${checked ? 'rgba(255,140,90,.55)' : 'var(--rs-border-card)'}`, background: checked ? 'rgba(255,105,38,.1)' : 'rgba(255,255,255,.03)', color: 'var(--rs-ink)', fontFamily: 'var(--font-sans)', textAlign: 'left', cursor: 'pointer', transition: 'background .2s,border-color .2s', width: '100%', ...style }} {...rest}>
      <span style={{ width: 26, height: 26, borderRadius: '50%', border: `2px solid ${checked ? 'var(--rs-orange)' : 'rgba(255,220,190,.35)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><span style={{ width: 12, height: 12, borderRadius: '50%', background: checked ? 'var(--rs-orange)' : 'transparent' }} /></span>
      <span><span style={{ display: 'block', fontSize: 19, fontWeight: 500 }}>{title}</span>{description && <span style={{ display: 'block', marginTop: 3, fontSize: 15, color: 'var(--rs-ink-4)' }}>{description}</span>}</span>
    </button>
  );
}
