import React from 'react';

/** Plain lowercase wordmark. No logo, no cube icon in the product UI. */
export function Wordmark({ size = 20, color = 'var(--rs-ink)', as = 'div', href, style, ...rest }) {
  const s = { fontFamily: 'var(--font-sans)', fontSize: size, fontWeight: 500, letterSpacing: '.04em', color, textDecoration: 'none', lineHeight: 1, ...style };
  if (href) return <a href={href} style={s} {...rest}>roomscout</a>;
  return React.createElement(as, { style: s, ...rest }, 'roomscout');
}
