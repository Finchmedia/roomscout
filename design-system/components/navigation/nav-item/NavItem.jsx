import React from 'react';

/** Settings / operator sidebar item: 50px, 12px radius, icon + label. current = subtle fill + warm border. */
export function NavItem({ icon, current, children, onClick, style }) {
  const [h, setH] = React.useState(false);
  return (
    <button onClick={onClick} aria-current={current ? 'page' : undefined} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{ display: 'flex', alignItems: 'center', gap: 14, height: 50, padding: '0 14px', borderRadius: 12, border: `1px solid ${current ? 'var(--rs-border-card-strong)' : 'transparent'}`, background: current ? 'rgba(255,255,255,.07)' : h ? 'rgba(255,255,255,.06)' : 'none', color: 'var(--rs-ink)', fontFamily: 'var(--font-sans)', fontSize: 16, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'background .15s', ...style }}>
      <span style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: current ? 'var(--rs-orange-light)' : 'var(--rs-ink-2)' }}>{icon}</span>{children}
    </button>
  );
}

/** Small uppercase group label used above NavItem groups ("Dein Scout", "Dein Konto"). */
export function NavGroupLabel({ children, style }) {
  return <div style={{ margin: '28px 10px 10px', fontFamily: 'var(--font-sans)', fontSize: 12, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--rs-ink-6)', ...style }}>{children}</div>;
}
