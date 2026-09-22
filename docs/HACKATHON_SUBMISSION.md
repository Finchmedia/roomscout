# RoomScout submission copy

Prepared September 22, 2026. The demo recording is complete; the video URL,
social links and entrant details still need to be entered in the submission
form. This file is copy for the form, not confirmation of a submitted entry.

## Project fields

- **App Title:** RoomScout
- **Tagline:** An AI scout that finds rehearsal rooms, talks to providers, and helps your band arrange a viewing.
- **App Website:** https://fleet-jackal-83.eu-west-1.convex.site
- **GitHub Repo:** https://github.com/Finchmedia/roomscout
- **Hosting answer:** convex.site
- **Tags (six):** convex, AllGasHackathon, OpenAI, Firecrawl, codex, AgentMail

## Description — ready to paste

### The problem

Finding a rehearsal room means searching scattered classifieds, studio websites
and portals, then repeating the same questions about price, availability,
equipment and sharing. The work continues long after finding a promising listing.

**RoomScout is an AI scout for your band: describe what you need, review suitable
rooms, and let Scout coordinate the conversation toward a viewing.**

### How it works

Talk or type to Scout. It turns your location, budget, schedule, equipment and
sharing preferences into a saved search brief. You can correct details naturally,
inspect candidates and their source evidence, answer follow-up questions, and
keep provider conversations together. Agreed viewing times appear on the room
and conversation, and Scout can tell you what is coming up.

The short video shows the basic user flow. The work behind that interface spans
several real integrations:

- **Firecrawl searches and extracts public room sources. Firecrawl Interact also
  operates a real browser:** in the controlled portal workflow, it registers an
  account, enters an email verification code, sends an inquiry through the page,
  and reads the resulting message thread. Saved browser profiles retain the
  portal session. This path uses the portal UI, not direct database shortcuts.
- **AgentMail provides personal inboxes** for verification mail and provider
  notifications. Its webhooks wake the Convex workflow; Firecrawl then imports
  portal replies for Scout to assess.
- **OpenAI powers conversation, extraction, matching and provider assessment**
  through the Convex AI Gateway, with live voice using the same saved search
  facts and Scout tools as text.
- **Convex coordinates the whole workflow:** durable agent threads and memory,
  indexed listings, matches, approvals, browser operations, scheduled work,
  notifications and viewing appointments. Realtime queries keep the interface
  current while background work continues.

### Features and human control

RoomScout supports voice and text, English and German, source-backed room
details, scoped follow-up questions, shared or permanent room preferences,
viewing appointments, and a self-service demo reset. Autopilot can handle allowed
non-binding communication under the musician's rules. Messages requiring review
have an explicit approval step; contracts, payments and binding commitments
remain with the musician.

### Real research, controlled demo

The September 21 public-index snapshot records **496 public listings with source
attribution**. This is a dated research count, not a claim of current availability.
The interactive demo uses a separate, disclosed fictional portal with **24 Berlin
rooms plus one Stuttgart room and responding AI providers**. Those seeded rooms
remain separate from public research and let the demo exercise real browser,
email and backend integrations without contacting real landlords.

A fresh production account previously completed portal registration, an inquiry,
an AI provider reply, email notification, inbox import and Scout assessment
through the normal application flow.

Turnstile blocked signup in our Firecrawl tests, so it is disabled on the demo
portal we own. That limitation remains unresolved; the demo does not demonstrate
automated signup through CAPTCHA-protected third-party portals.

### Why I built it and what was difficult

I built RoomScout to give musicians time back from fragmented searches and
repetitive coordination. Two early integration challenges shaped the project:

- **Structured Outputs through the Convex AI Gateway.** Requests initially
  failed because the provider adapter did not advertise Structured Outputs
  support: the AI SDK discarded the JSON Schema and downgraded the request to
  plain JSON mode. A minimal reproduction isolated the missing
  `supportsStructuredOutputs` flag. A small local adapter fix restored strict
  schema-based extraction and parsing. The finding was shared through the
  Convex Discord and subsequently fixed upstream.
- **Extending the official Firecrawl Convex component.** The published version
  we started with exposed crawling and scraping but did not yet expose Interact
  or Native Monitoring. We vendored the official component as a local fork,
  preserved its existing API, tests and MIT license, and added those interfaces.
  That made browser-based registration, verification and messaging available
  through the same Convex component as public-web discovery.

Browser orchestration also needed a redesign: translating every small browser
step into a separate remote call made a message take 16–46 API round trips.
Grouping work into one browser session and one Interact program per phase
reduced the standard message workflow to four calls: open, prepare, send and
close. This reduced network overhead while retaining the final authorization
check and delivery evidence.

### Tech stack

- React, Vite, TypeScript, Tailwind CSS and shadcn/ui
- Convex database, Auth, Agent, Workpool, scheduled functions and Static Hosting
- OpenAI through Convex AI Gateway, live voice and semantic embeddings
- Firecrawl Search, scraping and Interact browser automation
- AgentMail inboxes and webhooks; Mapbox maps and geocoding
- Built with Codex and Claude Code; implementation history is in `hackathon.md`

## Remaining form fields

- **Video Demo:** paste the public URL of the recorded video.
- **X / LinkedIn:** use the entrant's actual project post or profile links.
- **Your Name / Email:** enter the entrant's details directly in the form.
- **Team Info:** select the actual solo/team status. Suggested team name: RoomScout.
- **Screenshot:** use a readable product frame showing Scout and a room card or
  provider conversation. If visible in the recording, a confirmed viewing makes
  the result especially clear. Avoid exposing inbox addresses or account details.
- **Additional images:** the public-room map, search brief, conversation and
  viewing state are useful complementary views; only include screens that exist.
