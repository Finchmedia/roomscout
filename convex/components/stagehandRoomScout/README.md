# RoomScout Stagehand session metadata component

This local component preserves the non-sensitive session metadata table introduced
by RoomScout's earlier fork of Browserbase's `convex-stagehand` integration. See
[UPSTREAM.md](UPSTREAM.md) for its provenance.

Browser automation now runs in the app-owned Node runtime through the installed
Stagehand v4 SDK. This component performs no HTTP requests and exports no hosted
Stagehand transport actions. In particular, the retired REST `agentExecute`,
`observe`, `act`, `extract`, navigation, session-start, and session-end endpoints
are no longer callable here.

The internal `lib` module only records, reads, and updates provider session IDs,
context IDs, region, last requested URL, and lifecycle status. It never stores
credentials, cookies, DOM content, screenshots, form values, messages, OTPs, or
Live View URLs. Provider session creation, browser disconnect, and explicit
Browserbase release remain responsibilities of the app-owned v4 runtime and its
caller.
