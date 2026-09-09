import React from 'react';
import { Wordmark } from '../../core/wordmark/Wordmark.jsx';
import { Avatar } from '../../core/avatar/Avatar.jsx';

/** App header: wordmark left, optional status + controls + avatar right. 84px tall (64 narrow). */
export function AppHeader({ narrow, initials = 'HB', right, onAvatar, style }) {
  const h = narrow ? 64 : 84;
  return (
    <header style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: narrow ? '0 18px' : '0 36px', flex: 'none', fontFamily: 'var(--font-sans)', color: 'var(--rs-ink)', ...style }}>
      <Wordmark size={narrow ? 17 : 20} />
      <div style={{ display: 'flex', alignItems: 'center', gap: narrow ? 10 : 14 }}>
        {right}
        <Avatar initials={initials} size={narrow ? 38 : 42} interactive={!!onAvatar} onClick={onAvatar} aria-label="Profilmenü" />
      </div>
    </header>
  );
}
