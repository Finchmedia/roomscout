import React from 'react';

/** Initials circle ("HB"). Same outline treatment as header icon buttons. */
export function Avatar({ initials = 'HB', size = 42, interactive, style, ...rest }) {
  const Tag = interactive ? 'button' : 'div';
  return (
    <Tag style={{ width: size, height: size, borderRadius: '50%', border: '1px solid var(--rs-border-control)', background: 'var(--rs-surface-subtle)', color: 'var(--rs-ink)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-sans)', fontSize: Math.round(size * .31), fontWeight: 500, padding: 0, cursor: interactive ? 'pointer' : 'default', flex: 'none', ...style }} {...rest}>{initials}</Tag>
  );
}
