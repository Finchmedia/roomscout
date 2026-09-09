import React from 'react';

/** 56×32 toggle. Orange when on, subtle white when off. */
export function Switch({ checked, onChange, label, disabled, style, ...rest }) {
  return (
    <button role="switch" aria-checked={!!checked} aria-label={label} disabled={disabled} onClick={() => onChange && onChange(!checked)} style={{ width: 56, height: 32, borderRadius: 16, border: 0, padding: 0, background: checked ? 'var(--rs-orange)' : 'rgba(255,255,255,.14)', position: 'relative', cursor: disabled ? 'default' : 'pointer', transition: 'background .2s', flex: 'none', opacity: disabled ? .5 : 1, ...style }} {...rest}>
      <span style={{ position: 'absolute', top: 3, left: 3, width: 26, height: 26, borderRadius: '50%', background: '#fff', transform: checked ? 'translateX(24px)' : 'none', transition: 'transform .2s', boxShadow: 'var(--shadow-knob)' }} />
    </button>
  );
}
