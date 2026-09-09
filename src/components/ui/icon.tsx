import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * Icon — the RoomScout stroke-icon set as one component.
 *
 * DS spec: `design-system/components/core/icon/{Icon.jsx,Icon.d.ts,Icon.prompt.md,icon.card.html}`
 * and `design-system/guidelines/icons.html`; the iconography rules live in
 * `design-system/readme.md` § Iconography.
 *
 * The prototype draws every glyph as an inline SVG — no icon font, no CDN set,
 * no lucide. All 42 glyphs below are lifted **verbatim** from
 * `design-system/components/core/icon/Icon.jsx` (same `d` strings, same
 * primitives, same per-glyph stroke width): 24×24 viewBox, `currentColor`,
 * round caps and joins, stroke-width 1.6 for fact/nav glyphs, 1.7–1.9 for
 * controls, 2–2.2 for chevrons and checks; `mail` is the single 1.5 outlier, so
 * the set spans 1.5–2.2 (the DS's own "1.6–2.2" in `Icon.d.ts` and the "40
 * glyphs" count in `design-system/readme.md` are both stale). `play` and `bars`
 * are the two filled glyphs (`fill: currentColor`, no stroke).
 *
 * Usage notes from `Icon.prompt.md`:
 * - Fact glyphs are `pin` (Ort), `users` (Band), `clock` (Zeit), `drum`
 *   (Ausstattung); budget is a plain "€" text glyph, not an icon.
 * - Offer checkmarks are orange: `<Icon name="check" color="var(--rs-orange)" />`
 *   (the glyph already carries stroke 2.2).
 * - `ICON_NAMES` lists every name, in source order, for the gallery card.
 *
 * There is no icon-size token in `src/styles/tokens.css`, so `size` stays the
 * DS's plain pixel number (default 18) — the recurring 16 / 18 / 20 / 22 call
 * sites have no `--rs-icon-*` token to reach for yet. Colour is never baked in:
 * the SVG inherits `currentColor`, and `color` only sets the CSS `color`
 * property — pass a token (`var(--rs-orange)`, `var(--text-muted)`) or a
 * Tailwind text utility on `className`.
 *
 * Deliberate deviations from `Icon.jsx`, all recorded on purpose:
 * - `name` is the {@link IconName} union, not the DS's `name: string`. Call
 *   sites that index by data (`<Icon name={ICON[f.id]} />` in the gallery) need
 *   the source data typed as `IconName`, or an `as IconName` cast. The runtime
 *   `?? GLYPHS.close` fallback is kept for those casts and for untyped JS
 *   consumers, so a dynamic name can never render an empty box.
 * - `flex: none` ships as the `flex-none` utility instead of an inline style, so
 *   a consumer's `className="grow"` can win (twMerge resolves the conflict). In
 *   the DS the inline declaration beat every class; only a consumer `style` could
 *   override it.
 * - `focusable="false"` is added on top of the DS attributes — it keeps legacy
 *   Edge/IE from putting the glyph in the tab order and is inert elsewhere.
 * - `children` are rendered (the DS's JSX child `{p.d}` silently dropped them,
 *   contradicting its own `Icon.d.ts`), and rendered *before* the glyph so a
 *   `<title>` is the first child element of the `<svg>`, as the SVG spec and the
 *   accessible-name computation expect.
 */

/** One entry of the glyph registry. */
type Glyph = {
  /** The glyph's own stroke width; falls back to 1.7 like the DS. */
  sw?: number
  /** Filled glyph — painted with `currentColor`, no stroke. */
  fill?: boolean
  /** The glyph's primitives, verbatim from the prototype's inline SVG. */
  d: React.ReactNode
}

/* Icon paths lifted verbatim from the RoomScout prototype's inline SVGs (24×24 viewBox, round caps). */
const GLYPHS = {
  mic: { sw: 1.9, d: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /></> },
  "mic-off": { sw: 1.8, d: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3" /><path d="M4 4l16 16" /></> },
  keyboard: { sw: 1.7, d: <><rect x="3" y="6" width="18" height="12" rx="2" /><path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" /></> },
  send: { sw: 1.8, d: <path d="M4 12l16-8-6 16-2.5-6.5z" /> },
  transcript: { sw: 1.7, d: <><rect x="4" y="5" width="16" height="12" rx="3" /><path d="M8 10h8M8 13h5" /><path d="M9 17l-2 3" /></> },
  close: { sw: 2, d: <path d="M6 6l12 12M18 6L6 18" /> },
  check: { sw: 2.2, d: <path d="M5 12.5l4.5 4.5L19 7.5" /> },
  "chevron-down": { sw: 2, d: <path d="M6 9l6 6 6-6" /> },
  "chevron-up": { sw: 2, d: <path d="M6 15l6-6 6 6" /> },
  "chevron-right": { sw: 2, d: <path d="M9 6l6 6-6 6" /> },
  "arrow-left": { sw: 1.8, d: <path d="M19 12H5M11 6l-6 6 6 6" /> },
  "arrow-up-right": { sw: 2, d: <path d="M7 17L17 7M9 7h8v8" /> },
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
} satisfies Record<string, Glyph>

/** Every glyph name in the RoomScout set. */
type IconName = keyof typeof GLYPHS

/** The DS's `ICON_NAMES` export, in source order — the gallery card iterates it. */
const ICON_NAMES = Object.keys(GLYPHS) as IconName[]

/** The DS default stroke width, used when a glyph declares none. */
const DEFAULT_STROKE_WIDTH = 1.7

/** The DS default pixel size. */
const DEFAULT_SIZE = 18

// `React.ComponentProps<"svg">` rather than the DS's `React.SVGAttributes`:
// only the former carries `ref`, which React 19 passes as a plain prop (no
// forwardRef needed) and which Radix `asChild` / tooltip triggers require.
interface IconProps extends React.ComponentProps<"svg"> {
  /** Icon name from the RoomScout set; see {@link ICON_NAMES}. */
  name: IconName
  /** Pixel size (default 18). */
  size?: number
  /**
   * Overrides the glyph's own stroke width (1.5–2.2 in the set). A
   * non-positive value falls back to the glyph's own weight, like the DS's
   * `strokeWidth || p.sw || 1.7`.
   */
  strokeWidth?: number
  /** CSS `color` for the glyph — pass a token, e.g. `var(--rs-orange)`. */
  color?: string
  /**
   * Accessible name. Set it when the glyph carries meaning on its own (a status
   * icon in a table cell); it swaps the decorative `aria-hidden` for
   * `role="img"` + `aria-label`. Leave it off inside a labelled control — an
   * `IconButton`, a button with text — where the glyph is decorative.
   */
  label?: string
  /** Extra SVG content (e.g. a `<title>`), rendered before the glyph. */
  children?: React.ReactNode
  style?: React.CSSProperties
}

/**
 * Stroke icon from the RoomScout set. Inherits `currentColor`, so it takes the
 * ink of whatever it sits in; decorative by default (`aria-hidden`), which every
 * call site in the prototype relies on — pass `label` when a glyph carries
 * meaning on its own, which turns it into `role="img"` + `aria-label`. For an
 * external label, `aria-labelledby` still works: pass it together with
 * `role="img"` and `aria-hidden={false}`, both of which override the defaults.
 *
 * Unknown names fall back to `close`, exactly as the DS component does, so a
 * cast or untyped dynamic name can never render an empty box.
 */
function Icon({
  name,
  size = DEFAULT_SIZE,
  strokeWidth,
  color,
  label,
  className,
  style,
  children,
  ...props
}: IconProps) {
  const glyph: Glyph = GLYPHS[name] ?? GLYPHS.close
  const filled = glyph.fill === true
  // DS parity (`strokeWidth || p.sw || 1.7`): a non-positive override would
  // erase the stroke, so it falls back to the glyph's own weight.
  const stroke =
    strokeWidth !== undefined && strokeWidth > 0
      ? strokeWidth
      : (glyph.sw ?? DEFAULT_STROKE_WIDTH)
  const semantic = label !== undefined

  return (
    <svg
      data-slot="icon"
      data-icon={name}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={semantic ? "img" : undefined}
      aria-label={semantic ? label : undefined}
      aria-hidden={semantic ? undefined : true}
      focusable="false"
      className={cn("flex-none", className)}
      style={{ color, ...style }}
      {...props}
    >
      {children}
      {glyph.d}
    </svg>
  )
}

// `ICON_NAMES` is part of the DS's public API (the icon gallery iterates it);
// it is a derived array, not a literal, so react-refresh's allowConstantExport
// cannot recognise it as a constant.
// eslint-disable-next-line react-refresh/only-export-components
export { Icon, ICON_NAMES }
export type { IconName, IconProps }
