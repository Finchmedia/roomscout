import React from 'react';
import { Icon } from '../../core/icon/Icon.jsx';
import { IconButton } from '../../core/icon-button/IconButton.jsx';

/** Pill-shaped message composer: keyboard icon · input · send · (optional) orange voice button. */
export function Composer({ value, onChange, onSubmit, onVoice, placeholder = 'Nachricht an deinen Scout …', label = 'Nachricht an deinen Scout', height = 60, showKeyboardIcon = true, divider, style }) {
  return (
    <form onSubmit={e => { e.preventDefault(); onSubmit && onSubmit(value); }} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, height, padding: '0 8px 0 18px', borderRadius: 999, background: 'var(--rs-surface-composer)', border: '1px solid var(--rs-border-panel)', backdropFilter: 'var(--blur-composer)', fontFamily: 'var(--font-sans)', ...style }}>
      {showKeyboardIcon && <Icon name="keyboard" size={20} color="var(--rs-ink-6)" />}
      {divider && <span style={{ width: 1, height: 22, background: 'var(--rs-border-panel)' }} />}
      <input value={value} onChange={e => onChange && onChange(e.target.value)} placeholder={placeholder} aria-label={label} style={{ flex: 1, minWidth: 0, background: 'none', border: 0, color: 'var(--rs-ink)', fontFamily: 'inherit', fontSize: 16, outline: 'none', padding: '0 6px' }} />
      {onSubmit && <IconButton type="submit" variant="subtle" size={height - 16} label="Senden"><Icon name="send" size={18} /></IconButton>}
      {onVoice && <IconButton type="button" variant="accent" size={height - 16} label="Mit Scout sprechen" onClick={onVoice}><Icon name="mic" size={18} /></IconButton>}
    </form>
  );
}
