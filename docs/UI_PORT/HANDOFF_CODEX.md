# UI port — handoff for Codex (state as of 2026-09-10, branch `ui-port`)

Written by Claude (Fable) for the parallel Codex session. Everything below is on branch
`ui-port`, commits `4b3a535..2924a88` on top of the `main` checkpoint `200c54c`
(which snapshotted Codex's earlier uncommitted frontend port + backend work).

## What was built

1. **Design system mirror** — `design-system/` is a verbatim copy of the Claude Design
   project "RoomScout Design System" (tokens, 27 component specs as JSX + `.d.ts` +
   prompts, guidelines, `ui_kits/` with React recreations of every screen). It is the
   **binding visual spec**. `design-system/readme.md` holds the brand/content rules
   (du/ihr, Scout speaks as "ich", sentence case, one orange, pill buttons, no dashboards
   in the band-facing flow). Excluded from ESLint; renders are gitignored.
2. **Implementation map** — `docs/UI_PORT/`: exhaustive screen docs extracted from the
   prototype export (`SCOUT_SCREENS.md`, `SCOUT_STATE.md`, `SETTINGS_SCREENS.md`,
   `OPERATOR_SCREENS.md`, `LANDING_SCREENS.md`), `TOKENS.md`, `COMPONENT_MAP.md`,
   `DATA_MAP.md` (current Convex contracts per route), `DATA_BINDING_PLAN.md` (how each
   prototype element binds to backend state; §3 has `deriveScoutStage`), `BACKLOG.md`
   (legacy UI without a prototype home, both directions), `DECISIONS.md` (115 answered
   questions — **binding**), `REVIEW_COPY.md` (179 proposed DE/EN strings awaiting the
   maintainer), `README.md` (reading order).
3. **Token layer** — `src/styles/tokens.css`: DS tokens verbatim (`--rs-*`, semantic
   aliases, radii, shadows, keyframes, reduced-motion), a full mapping onto the shadcn v4
   variables, a Tailwind v4 `@theme inline` block (utilities like `bg-rs-surface-card`,
   `text-rs-ink-6`, `rounded-card`, `shadow-menu`, `animate-rs-fade-up`), the `.rs-bg` /
   `.rs-grain` background stack, and legacy aliases (`--signal`, `--ink`, `--panel` …).
   `app.css` / `design-system.css` lost their `:root` tokens and the raw-photo body
   background; legacy pages now sit on the flat page colour.
4. **Components** — `src/components/ui/`: 19 shadcn v4 primitives installed via the CLI and
   restyled to the DS (button with variants `primary|secondary|tint|ghost|link|danger`
   and sizes `lg|md|base|sm|xs|2xs`, dialog, sheet, dropdown-menu, tabs, tooltip, sonner,
   table, accordion, input, textarea, switch, separator, skeleton, sidebar, breadcrumb,
   avatar, badge, scroll-area) plus 19 DS atoms as TSX (icon with every prototype glyph,
   icon-button, card, capsule, summary-pill, overline, status-dot, wordmark, hint, notice,
   chat-bubble, radio-card, stepper, composer, voice-control, scout-blob, fact-list).
   Chrome in `src/ui/chrome/`: `StageBackground`, `AppHeader`, `PanelDialog` (the shadcn
   `sidebar-13` pattern: Dialog + Sidebar + Breadcrumb header + close; Settings and
   Operator are built on it). Gallery of every variant at `/design`.
5. **Copy layer** — `src/ui/copy/`: 885 German strings extracted verbatim per surface
   (`de/{scout,settings,operator,landing,common}.ts`, dev-only strings in `de/dev.ts`),
   typed `useCopy()` (`t`, `tp`), `LocaleProvider` with a dictionary registry (German
   default; English registers later without a silent fallback), `LanguageToggle`,
   formatting helpers (24h time), 23 tests.
6. **Surfaces** — ported 1:1 from `design-system/ui_kits/*.jsx` with local demo state,
   **no Convex**: `src/ui/settings` (7 pages, connection sheet, import dialog, discard
   gate), `src/ui/operator` (6 pages, diagnostics sheet, incident flow), `src/ui/scout`
   (all stages, header, profile menu, transcript drawer, dev chapter bar), `src/ui/landing`.
   Routes: `/design/settings`, `/design/operator`, `/design/scout`, `/design/landing`.

## Changes outside the new directories (read before touching)

- `src/app/providers.tsx`: wraps the app in `LocaleProvider` and mounts the **single**
  `<Toaster />` (sonner). Do not mount another.
- `src/app/router.tsx`: five public `/design*` routes added; nothing else changed.
  **`/app/*` and `/ops/*` still render the legacy UI** — the switch waits until Codex's
  E2E tests are done (maintainer decision).
- `components.json`: `tailwind.config = ""` so the shadcn CLI resolves the v4 registry.
  `src/components/ui/table.tsx` was regenerated (superset of the old exports).
- `eslint.config.js`: `design-system/` ignored; override for `src/components/ui/**` and
  `src/ui/**` warning on raw hex/rgb colors. `src/hooks/use-mobile.ts` added.
- `package.json`: `class-variance-authority`, `radix-ui`, `sonner` added. `artifacts/`,
  `design-system/assets/renders/`, `.claude/settings.local.json` gitignored.
- `public/design/partners/`: five partner logos for the operator integrations grid.
- **Uncommitted, in Codex's files, behaviour-neutral, take or drop them:**
  `convex/matchingCore.ts` (optional coordinates narrowed via locals so `tsc` passes after
  the schema change) and `convex/portalConnections.ts:929` (`let sourceUrl: URL | null;`
  for `no-useless-assignment`). Codex's own uncommitted `convex/` work was not touched.
- `.claude/settings.local.json` sets `disableAllHooks: true` (maintainer request: the
  convex plugin's Stop hook kept blocking on in-flight test files). Run
  `npx tsc -p convex/tsconfig.json --noEmit` manually when touching `convex/`.

## Conventions for the new UI (from DECISIONS.md)

- Tokens only: `var(--rs-…)` or the generated Tailwind utilities; no raw colors/sizes.
- Every user-visible string through `useCopy()`; missing strings go to `REVIEW_COPY.md`,
  never invented inline.
- `src/components/ui/*` stays CLI-regenerable + DS-spec-driven; screen composition lives
  in `src/ui/<surface>/`. Nothing under `src/ui/**` imports from `src/components/**`
  except `@/components/ui/*`.
- Narrow breakpoint ≤959px only (no phone frame); shadcn accessibility behaviours stand;
  prototype defects are fixed, not reproduced.
- Demo state files are marked "demo data" in their header and must not be wired to
  production by accident.

## Not done yet (in order)

1. Convex wiring of the Scout surface (`DATA_BINDING_PLAN.md` §3 `deriveScoutStage`, §4)
   and the three data-backed Settings pages (sources, autonomy, knowledge).
2. Route switch `/app/scout` → new Scout, `/app/settings` → new Settings, `/ops` → new
   Operator; legacy tools leave the nav but keep their routes (`BACKLOG.md`).
3. English dictionary `src/ui/copy/en.ts` + parity test; maintainer review of
   `REVIEW_COPY.md` (items 10/15/30 in DECISIONS).
4. Rewrite of the legacy UI tests that pin old markup (list in `DATA_MAP.md` §5).

## Verify

`npm run typecheck && npm run lint && npm test && npm run build` — all green at
`2924a88` (599 tests). Dev server: `npm run dev`, then open the `/design*` URLs.
