import React from 'react';

/** Uppercase, letter-spaced section label. muted (default) or accent ("ANGEBOT EINGEGANGEN"). */
export function Overline({ tone = 'muted', wide, children, style, ...rest }) {
  return <div style={{ fontFamily: 'var(--font-sans)', fontSize: 12.5, letterSpacing: wide ? '.18em' : tone === 'accent' ? '.16em' : '.14em', textTransform: 'uppercase', fontWeight: tone === 'accent' ? 500 : 400, color: tone === 'accent' ? 'var(--rs-orange-light)' : 'var(--rs-ink-6)', ...style }} {...rest}>{children}</div>;
}
