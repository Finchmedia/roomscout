import React from 'react';
import { Icon } from '../../core/icon/Icon.jsx';

const ICON = { ort: 'pin', budget: null, band: 'users', zeit: 'clock', equip: 'drum' };

/** "Euer Suchauftrag": the brief as a list of facts with quiet icons. floating = light group next to the conversation; card = central review card; compact = inline expansion. */
export function FactList({ facts = [], variant = 'floating', title = 'Euer Suchauftrag', onEdit, editing, drafts = {}, onDraftChange, children, style }) {
  const card = variant === 'card';
  return (
    <div style={{ width: card ? 'min(520px,100%)' : variant === 'compact' ? 'min(380px,100%)' : 300, padding: card ? '26px 28px 28px' : variant === 'compact' ? '14px 18px' : '14px 16px', borderRadius: card ? 26 : 16, background: card ? 'rgba(18,14,12,.78)' : variant === 'compact' ? 'var(--rs-surface-card)' : 'rgba(18,14,12,.5)', border: `1px solid ${card ? 'var(--rs-border-panel)' : 'var(--rs-border-card-soft)'}`, boxShadow: card ? 'var(--shadow-card-float)' : 'none', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: card ? 4 : 2, fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: card ? 10 : 6 }}>
        <div style={card ? { fontSize: 21 } : { fontSize: 11.5, letterSpacing: '.09em', textTransform: 'uppercase', color: 'var(--rs-ink-6)' }}>{title}</div>
        {onEdit && !editing && <button onClick={onEdit} aria-label="Suchauftrag bearbeiten" style={{ width: 36, height: 36, borderRadius: '50%', border: 0, background: 'none', color: 'var(--rs-ink-2)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="edit" size={18} /></button>}
      </div>
      {facts.map(f => (
        <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: card ? 14 : 12, height: card ? 44 : 34, padding: '0 6px', borderRadius: 8, fontSize: card ? 17 : 14, borderBottom: card ? '1px solid var(--rs-border-divider-soft)' : 0, background: f.changed ? 'rgba(255,105,38,.18)' : 'transparent', transition: 'background .5s', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ width: 22, height: 22, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--rs-ink-2)' }}>
            {f.id === 'budget' ? <span style={{ fontSize: 19, lineHeight: 1 }}>€</span> : ICON[f.id] ? <Icon name={ICON[f.id]} size={card ? 20 : 18} /> : <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--rs-orange-light)' }} />}
          </span>
          {editing ? <input value={drafts[f.id] !== undefined ? drafts[f.id] : f.label} onChange={e => onDraftChange && onDraftChange(f.id, e.target.value)} aria-label="Kriterium bearbeiten" style={{ flex: 1, minWidth: 0, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,200,160,.25)', borderRadius: 8, color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 16, padding: '6px 10px', outline: 'none' }} /> : <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.label}</span>}
        </div>
      ))}
      {children}
    </div>
  );
}
