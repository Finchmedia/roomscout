import React from 'react';

/** Dark translucent pill that summarises the brief ("Stuttgart · bis 350 €"). Optional leading icon and trailing chevron; clickable to expand. */
export function SummaryPill({ icon, chevron, open, children, size = 'md', onClick, style, ...rest }) {
  const [h, setH] = React.useState(false);
  const hgt = { sm: 36, md: 44, lg: 50 }[size];
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ height: hgt, padding: size === 'lg' ? '0 20px' : '0 16px', borderRadius: 999, border: '1px solid var(--rs-border-card-strong)', background: h && onClick ? 'rgba(30,22,16,.7)' : 'var(--rs-surface-pill)', color: size === 'lg' ? 'var(--rs-ink)' : 'var(--rs-ink-2)', fontFamily: 'var(--font-sans)', fontSize: size === 'lg' ? 16 : 14.5, display: 'inline-flex', alignItems: 'center', gap: 10, cursor: onClick ? 'pointer' : 'default', whiteSpace: 'nowrap', ...style }} {...rest}>
      {icon}{children}
      {chevron && <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .3s' }}><path d="M6 9l6 6 6-6" /></svg>}
    </Tag>
  );
}
