import React from 'react';

/** −/+ number stepper (40px tall, 10px radius). */
export function Stepper({ value, onChange, min = 1, max = 99, label, style }) {
  const [h, setH] = React.useState(null);
  const btn = (k) => ({ width: 42, height: 40, border: 0, background: h === k ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.05)', color: 'var(--rs-ink)', fontFamily: 'var(--font-sans)', fontSize: 18, cursor: 'pointer' });
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', border: '1px solid rgba(255,220,190,.2)', borderRadius: 10, overflow: 'hidden', fontFamily: 'var(--font-sans)', ...style }}>
      <button aria-label="Weniger" onMouseEnter={() => setH('d')} onMouseLeave={() => setH(null)} onClick={() => onChange && onChange(Math.max(min, value - 1))} style={btn('d')}>−</button>
      <input value={value} onChange={e => onChange && onChange(e.target.value)} inputMode="numeric" aria-label={label} style={{ width: 56, height: 40, textAlign: 'center', border: 0, background: 'none', color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 17, outline: 'none' }} />
      <button aria-label="Mehr" onMouseEnter={() => setH('i')} onMouseLeave={() => setH(null)} onClick={() => onChange && onChange(Math.min(max, value + 1))} style={btn('i')}>+</button>
    </div>
  );
}
