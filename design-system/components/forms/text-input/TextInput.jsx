import React from 'react';

/** Rectangular settings input (46px, 12px radius, inset dark). invalid = red helper text. */
export function TextInput({ value, onChange, placeholder, label, invalid, helper, style, inputStyle, ...rest }) {
  return (
    <div style={{ fontFamily: 'var(--font-sans)', ...style }}>
      <input value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} aria-label={label} aria-invalid={!!invalid} style={{ width: '100%', height: 46, padding: '0 16px', borderRadius: 12, border: `1px solid ${invalid ? 'rgba(255,138,106,.6)' : 'var(--rs-border-panel)'}`, background: 'var(--rs-surface-inset)', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 15, outline: 'none', ...inputStyle }} {...rest} />
      {helper && <div role={invalid ? 'alert' : undefined} style={{ marginTop: 8, fontSize: 14, color: invalid ? 'var(--rs-red-text)' : 'var(--rs-ink-6)' }}>{helper}</div>}
    </div>
  );
}
