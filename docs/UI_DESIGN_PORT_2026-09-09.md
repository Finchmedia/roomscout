# Claude Design → RoomScout implementation

The maintainer-supplied interactive export is the visual reference, not a second
application runtime. This port uses its grain background, room illustration and
hero preview, rebuilds the interactions as React components, and retains the
existing Convex backend. The Claude `support.js` runtime is not shipped.

## Surface mapping

| Reference | Application | Source of truth |
| --- | --- | --- |
| Landing v2 | `/` — hero, scroll story, adaptive fact card, decision branches, offer example, bento, FAQ | Explicitly illustrative marketing story; CTAs enter the authenticated Scout |
| Roomscout | `/app/scout` — voice-first arrival, optional chat, live facts, brief review, waiting, questions and results | Saved need, Scout thread, matches, opportunities, provider conversations and mandates |
| Settings | `/app/settings/:section` — sources, autonomy, memory, profile, notifications, usage and privacy | Existing authenticated queries/mutations; unsupported capabilities are labelled unavailable |
| Operator | `/ops` and its existing subroutes — overview, sources, signals, outreach, inbox, audit | Existing operator-protected tools and real queues; no simulated incidents or fake counts |

The old profile route remains compatible. The consumer sidebar is replaced by a
wordmark and profile menu. Search forms, Inbox, Explore and the authenticated map
remain reachable; existing tools are not removed to simplify the main screen.
Operator tables and legacy forms receive the shared visual treatment rather than
reproducing illustrative prototype records or inventing new backend settings.

## Interaction and state boundaries

- Starting voice is explicit and requests the real browser microphone permission.
  The ongoing session is owned above the authenticated routes, with mute/end
  controls while visiting settings or `/app/map`.
- Facts are projected from the persisted need, including flexible typed facets.
  Stable keys update a corrected value in place. New rows animate into the list;
  the brief review uses the same visual language. Reduced motion removes motion.
- `Scout losschicken` calls the existing default Autopilot mutation only after an
  explicit brief review. Offers still use the existing exact acceptance dialog.
  UI animation never creates a match, sends mail or fabricates provider progress.
- Voice response batches are deduplicated and continued once. Transcript slots
  preserve speech order; late startup/tool completions cannot revive or write
  into a different session. Known provider errors become safe user-facing copy.
- Backend transport configuration now belongs on `VoiceSessionProvider.options`,
  not presentation-only `RealtimeVoiceScout` props.
- Settings/search prefer the persisted Scout active need over newest-created
  records. Source toggles show pending state and retain a safe error on failure.

## Verification and remaining boundaries

Local tests cover the real frontend data contracts with mocked subscriptions,
fact correction, explicit activation, dismissal, settings navigation, persistent
voice ownership, cancellation, stale tool results and optional transcript UI.
The public landing and authentication entry were inspected in the local browser,
including both illustrative decision branches. Authenticated visual review and a
live microphone/provider round trip still require a signed-in browser session.

Final local gate: 476 tests across 83 files, TypeScript, ESLint, production build
and whitespace diff checks pass. No contact-address-shaped text was found in the
public hackathon/build logs during the required privacy scan.

This is not a new proof of autonomous portal registration, mail delivery, browser
reply retrieval or offer negotiation. Existing backend work and its proof gaps
remain recorded separately in the build log. No backend deployment, static
deployment, commit or push is part of this design-port checkpoint. The separate
controlled portal is unchanged.
