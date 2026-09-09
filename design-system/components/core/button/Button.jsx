import React from 'react';

const H = { lg: 60, md: 56, base: 50, sm: 46, xs: 44, '2xs': 36 };
const PX = { lg: 34, md: 32, base: 24, sm: 22, xs: 20, '2xs': 14 };
const FS = { lg: 19, md: 17, base: 16, sm: 15, xs: 15, '2xs': 13.5 };

/** Pill button. primary = orange; secondary = outlined translucent; tint = orange-tinted (answer chips); ghost = bare text; link = underlined text; danger = red circle-ish. */
export function Button({ variant = 'primary', size = 'base', icon, children, block, disabled, style, hovered, ...rest }) {
  const [hov, setHov] = React.useState(false);
  const h = hovered ?? hov;
  const base = { height: H[size], padding: `0 ${PX[size]}px`, borderRadius: 999, border: 0, fontFamily: 'var(--font-sans)', fontSize: FS[size], fontWeight: 600, display: block ? 'flex' : 'inline-flex', width: block ? '100%' : undefined, alignItems: 'center', justifyContent: 'center', gap: 12, cursor: disabled ? 'default' : 'pointer', transition: 'background .2s,color .2s,transform .2s', whiteSpace: 'nowrap', opacity: disabled ? .5 : 1 };
  const v = {
    primary: { background: h ? 'var(--rs-orange-hover)' : 'var(--rs-orange)', color: '#fff', boxShadow: size === 'lg' ? 'var(--shadow-accent-button)' : size === 'md' ? 'var(--shadow-accent-button-sm)' : 'none', transform: h && size === 'lg' ? 'translateY(-1px)' : 'none' },
    secondary: { background: h ? 'var(--rs-surface-hover)' : 'rgba(255,255,255,.05)', color: 'var(--rs-ink)', border: '1px solid var(--rs-border-control-strong)', fontWeight: 500 },
    tint: { background: h ? 'var(--rs-surface-accent-tint-hover)' : 'rgba(255,105,38,.14)', color: 'var(--rs-orange-tint-2)', border: '1px solid rgba(255,140,90,.45)', fontWeight: 500 },
    ghost: { background: 'none', color: h ? '#fff' : 'var(--rs-ink-3)', fontWeight: 400, padding: '8px 12px', height: 'auto', borderRadius: 8, gap: 10 },
    link: { background: 'none', color: h ? '#fff' : 'var(--rs-ink-3)', fontWeight: 400, padding: '8px 12px', height: 'auto', textDecoration: 'underline', textUnderlineOffset: 4, textDecorationColor: 'rgba(255,220,190,.35)' },
    danger: { background: h ? 'var(--rs-red-hover)' : 'var(--rs-red)', color: '#fff' },
  }[variant];
  return (
    <button disabled={disabled} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} style={{ ...base, ...v, ...style }} {...rest}>
      {icon}{children}
    </button>
  );
}
