import React from 'react';

const R = { sm: 16, md: 20, lg: 22, xl: 24, '2xl': 26, panel: 28 };
const PAD = { sm: '14px 18px', md: '24px 26px', lg: '34px 36px 30px', xl: '28px 36px 30px', '2xl': '32px 34px', panel: 0 };

/** Dark, slightly translucent card with a very fine warm border. No frosted glass, no glowing frames. tone: default | soft | faint | accent (orange border) | warning (amber). */
export function Card({ size = 'md', tone = 'default', hoverLift, padding, children, style, ...rest }) {
  const [h, setH] = React.useState(false);
  const bg = { default: 'var(--rs-surface-card)', soft: 'var(--rs-surface-card-soft)', faint: 'var(--rs-surface-card-faint)', accent: 'var(--rs-surface-card)', warning: 'var(--rs-surface-amber-tint)', inset: 'var(--rs-surface-inset)', panel: 'var(--rs-surface-panel)', rust: 'var(--rs-rust-faint)' }[tone];
  const border = { default: 'var(--rs-border-card)', soft: 'var(--rs-border-card)', faint: 'var(--rs-border-card-soft)', accent: 'var(--rs-border-accent-faint)', warning: 'var(--rs-border-amber)', inset: 'var(--rs-border-card)', panel: 'var(--rs-border-panel)', rust: 'rgba(255,140,90,.22)' }[tone];
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ background: bg, border: `1px solid ${border}`, borderRadius: R[size], padding: padding ?? PAD[size], fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', textAlign: 'left', boxShadow: tone === 'panel' ? 'var(--shadow-panel)' : 'none', transition: 'transform .3s', transform: hoverLift && h ? 'translateY(-3px)' : 'none', ...style }} {...rest}>{children}</div>
  );
}
