import React from 'react';

const ANIM = { idle: 'rsBreathe 5.2s ease-in-out infinite', speaking: 'rsSpeak 1.6s ease-in-out infinite', listening: 'rsListen 3.2s ease-in-out infinite', still: 'none' };

/** The Scout: an organic orange blob with a soft local glow. Never boxed into a card. */
export function ScoutBlob({ size = 168, state = 'idle', glow = true, style, ...rest }) {
  return (
    <div aria-hidden="true" style={{ width: size, height: size, flex: 'none', ...style }} {...rest}>
      <div style={{ width: '100%', height: '100%', borderRadius: 'var(--blob-shape)', background: 'var(--blob-gradient)', boxShadow: glow ? (size < 80 ? 'var(--shadow-blob-sm)' : 'var(--shadow-blob)') : 'none', animation: ANIM[state] || ANIM.idle, transition: 'box-shadow .6s' }} />
    </div>
  );
}
