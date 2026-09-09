import React from 'react';

/* Icon paths lifted verbatim from the RoomScout prototype's inline SVGs (24×24 viewBox, round caps). */
const P = {
  mic: { sw: 1.9, d: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></> },
  'mic-off': { sw: 1.8, d: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /><path d="M4 4l16 16" /></> },
  keyboard: { sw: 1.7, d: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></> },
  send: { sw: 1.8, d: <path d="M4 12l16-8-6 16-2.5-6.5z" /> },
  transcript: { sw: 1.7, d: <><rect x="4" y="5" width="16" height="12" rx="3" /><path d="M8 10h8M8 13h5" /><path d="M9 17l-2 3" /></> },
  close: { sw: 2, d: <path d="M6 6l12 12M18 6L6 18" /> },
  check: { sw: 2.2, d: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
  'chevron-down': { sw: 2, d: <path d="M6 9l6 6 6-6" /> },
  'chevron-up': { sw: 2, d: <path d="M6 15l6-6 6 6" /> },
  'chevron-right': { sw: 2, d: <path d="M9 6l6 6-6 6" /> },
  'arrow-left': { sw: 1.8, d: <path d="M19 12H5M11 6l-6 6 6 6" /> },
  'arrow-up-right': { sw: 2, d: <path d="M7 17L17 7M9 7h8v8" /> },
  pin: { sw: 1.6, d: <><path d="M12 21s-6-5.3-6-10a6 6 0 0 1 12 0c0 4.7-6 10-6 10z" /><circle cx="12" cy="11" r="2" /></> },
  users: { sw: 1.6, d: <><circle cx="9" cy="8" r="3.2" /><circle cx="16.5" cy="9" r="2.6" /><path d="M3.5 19c.5-3.3 2.6-5 5.5-5s5 1.7 5.5 5" /><path d="M15 14.4c2.6 0 4.3 1.5 4.8 4.4" /></> },
  clock: { sw: 1.6, d: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></> },
  drum: { sw: 1.6, d: <><ellipse cx="12" cy="8" rx="8" ry="3" /><path d="M4 8v8c0 1.7 3.6 3 8 3s8-1.3 8-3V8" /><path d="M8 10.5v8M16 10.5v8" /></> },
  search: { sw: 1.8, d: <><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></> },
  list: { sw: 1.8, d: <path d="M5 7h14M5 12h14M5 17h9" /> },
  edit: { sw: 1.7, d: <path d="M4 20l4-.8L19.5 7.7a1.8 1.8 0 0 0-2.6-2.6L5.3 16.6z" /> },
  pause: { sw: 2.2, d: <path d="M9 6v12M15 6v12" /> },
  play: { fill: true, d: <path d="M8 5.5v13l10-6.5z" /> },
  restart: { sw: 2, d: <><path d="M4 12a8 8 0 1 0 2.5-5.8" /><path d="M4 4v5h5" /></> },
  sliders: { sw: 1.7, d: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></> },
  globe: { sw: 1.6, d: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17M12 3.5c3 3 3 14 0 17M12 3.5c-3 3-3 14 0 17" /></> },
  doc: { sw: 1.6, d: <><path d="M6 3h9l4 4v14H6z" /><path d="M9 12h6M9 16h6" /></> },
  user: { sw: 1.6, d: <><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20c.8-3.8 3.7-6 7.5-6s6.7 2.2 7.5 6" /></> },
  bell: { sw: 1.6, d: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2H4.5z" /><path d="M10 20a2 2 0 0 0 4 0" /></> },
  card: { sw: 1.6, d: <><rect x="3" y="6" width="18" height="12" rx="2.5" /><path d="M3 10h18" /></> },
  shield: { sw: 1.6, d: <path d="M12 3l7 3v5c0 4.5-3 8.5-7 10-4-1.5-7-5.5-7-10V6z" /> },
  lock: { sw: 1.8, d: <><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></> },
  building: { sw: 1.6, d: <><path d="M4 21V5h9v16M13 9h7v12" /><path d="M7 9h3M7 13h3M7 17h3M16 13h1M16 17h1" /></> },
  home: { sw: 1.6, d: <path d="M4 11l8-7 8 7v9H4z" /> },
  mail: { sw: 1.5, d: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></> },
  bars: { fill: true, d: <><rect x="4" y="13" width="4" height="7" rx="1" /><rect x="10" y="8" width="4" height="12" rx="1" /><rect x="16" y="4" width="4" height="16" rx="1" /></> },
  database: { sw: 1.6, d: <><ellipse cx="12" cy="6" rx="8" ry="3" /><path d="M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" /></> },
  tasks: { sw: 1.6, d: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4h6v3H9z" /><path d="M8.5 13l2 2 4-4" /></> },
  plug: { sw: 1.6, d: <><path d="M9 3v4M15 3v4" /><path d="M6 7h12v4a6 6 0 0 1-12 0z" /><path d="M12 17v4" /></> },
  flag: { sw: 1.6, d: <path d="M5 21V4h11l-1.5 3.5L16 11H5" /> },
  pulse: { sw: 1.6, d: <path d="M3 12h4l3-7 4 14 3-7h4" /> },
  music: { sw: 1.6, d: <><path d="M9 18V6l10-2v12" /><circle cx="6.5" cy="18" r="2.5" /><circle cx="16.5" cy="16" r="2.5" /></> },
  plus: { sw: 2, d: <path d="M5 12h14M12 5v14" /> },
  minus: { sw: 2, d: <path d="M5 12h14" /> },
};

export const ICON_NAMES = Object.keys(P);

/** Stroke icon from the RoomScout set. Inherits currentColor. */
export function Icon({ name, size = 18, strokeWidth, color, style, ...rest }) {
  const p = P[name] || P.close;
  const fill = p.fill;
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth={strokeWidth || p.sw || 1.7} strokeLinecap="round" strokeLinejoin="round" style={{ flex: 'none', color, ...style }} aria-hidden="true" {...rest}>{p.d}</svg>
  );
}
