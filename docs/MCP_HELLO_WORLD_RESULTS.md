# MCP hello-world proof — execution results

## Current status — September 20, 2026

**Isolated MCP reenabled; durable revocation and an actual ChatGPT disconnect are proven.**
The user authorized a targeted follow-up to the completed companion. The proof
now registers a local extension of Codefox 0.4.2; its npm client and the Gateway
remain pinned. Existing RoomScout runtime code, deployments and secrets are unchanged.

- Each authorization code and token is bound to an immutable authorization-row ID.
  Revoke deletes that grant; regrant creates a different ID. Old credentials
  cannot revive, including pre-fix credentials without the new binding.
- MCP verifies the signed bearer and its indexed SHA-256 token record against
  that exact active grant. Code consumption, token persistence and refresh
  rotation also check the grant inside their mutations.
- Added and advertised `POST /api/oauth/revoke`, with public-client token possession
  and configured confidential-client authentication. Unknown/already-revoked
  tokens return an opaque success. Replaying an old revoke cannot kill a new grant.
- **21/21 focused revocation checks passed**, with explicit 401s for revoked access
  tokens before and after reconnect. Covered refresh rejection/rotation, stale
  authorization codes, wrong-client isolation, idempotency and token-only public
  client revocation. Typecheck/build and isolated deployment passed. No broad suite,
  load/concurrency test or confidential-client smoke was run.
- **Real ChatGPT:** a newly registered private test app completed consent. Clicking
  **Trennen** produced `POST /api/oauth/revoke` with `revoked: true` at
  `2026-09-20T01:21:38Z`; the account page subsequently showed no active grant.
  The callback was not visible in the immediate post-click snapshot. An older
  app produced no observed callback; cached metadata is plausible but unproven.
  For self-testing, register afresh or use the account page's Disconnect client.
- `MCP_PROOF_ENABLED=true`; the hello-only endpoint is available for self-testing.
  Both browser-test grants were revoked (the old one via RoomScout, the new one
  via ChatGPT). No RoomScout domain tools or provider messaging were added.

Source: sibling `roomscout-mcp-proof`, notably `convex/http.ts`,
`convex/oauthProvider.ts`, `vendor/oauth-provider/component/{grants,tokenAccess,mutations,schema}.ts`
and `scripts/smoke.mjs`. The vendor directory retains the upstream Apache-2.0
license and documents the changes. Hashed token/code records are retained until
the disposable deployment expires; production cleanup/hardening remain separate.

## Historical result — September 19, 2026

2026-09-19 · **Target-client flow proven; integration blocked by revocation.**

Executed the bounded [companion plan](MCP_HELLO_WORLD_PLAN.md). Both stock components work with Convex Auth v2 and the actual ChatGPT client. No component was patched. Existing RoomScout development and production deployments, runtime code, dependencies and environment files were untouched.

## What worked in ChatGPT

Created the private **RoomScout Hello Proof** custom app using OAuth discovery and dynamic client registration. The flow was:

1. Connect from ChatGPT.
2. Choose **Create account** in the authorization popup and create a synthetic username/password account with Convex Auth v2.
3. Resume consent immediately, without band-profile onboarding.
4. Approve `roomscout:hello` and `offline_access`; complete the S256 PKCE exchange.
5. Refresh the app's tools, select it in a chat and invoke its single `hello` tool.
6. Receive `Hello from RoomScout` and the authenticated synthetic user's label.

The client used OAuth, with its optional OpenID Connect setting disabled. No email/profile identity scopes were needed. This proves signup during connection; an existing RoomScout account is not required. It does not expose ChatGPT memory: a later profile tool can accept only selected, confirmed band details, as described in the [full implementation plan](MCP_IMPLEMENTATION_PLAN.md).

## Isolated deployment and source

| Item | Value |
| --- | --- |
| Source | Sibling project `../roomscout-mcp-proof` with pinned lockfile |
| Deployment | `precise-chinchilla-292`, reference `dev/mcp-hello-20260919` |
| Site / consent frontend | [Isolated proof](https://precise-chinchilla-292.eu-west-1.convex.site) |
| MCP resource / audience | `https://precise-chinchilla-292.eu-west-1.convex.site/api/mcp` |
| OAuth issuer | `https://precise-chinchilla-292.eu-west-1.convex.site/api/oauth` |
| Lifetime | Seven-day disposable deployment, created September 19; expiry approximately September 26, 2026 |
| MCP state at September 19 stopping point | **Disabled** at that time; reenabled after the September 20 fix above |

Versions: Convex `1.45.0`, `@convex-dev/auth` `2.0.0-alpha.1`, `@codefox-inc/oauth-provider` `0.4.2`, `convex-mcp-gateway` `2.0.0`, `@convex-dev/static-hosting` `0.2.1`, `jose` `6.2.3`, React/React DOM `19.2.8`, Vite `8.2.2`, TypeScript `6.0.3`.

The deployment has its own scoped deploy key, synthetic database and separate fresh first-party/OAuth signing keys. Credentials and local evidence containing secrets are ignored; no token, password or private ChatGPT conversation URL is included in this report.

## Authorization wiring

The first-party Convex trust configuration accepts only its own Auth v2 issuer and `convex` audience. The Codefox bearer reaches the Gateway's custom resolver, which verifies signature, issuer, exact MCP audience, expiry, scope and an existing authorization grant. Only then does Gateway inject the verified identity into an internal `hello` query.

Consent parameters remain server-side behind an expiring, single-use continuation. An HttpOnly, Secure browser cookie binds the request; authenticated consent endpoints enforce the browser binding and same-origin submission. Neither the browser nor the MCP tool caller selects a user identity. MCP requires authentication, including its initialization challenge.

## Focused verification

The standalone TypeScript/build checks passed. The final functional smoke ran **20 checks: 19 passed, one failed**. No full RoomScout suite or load test was run.

| Check group | Observation |
| --- | --- |
| Synthetic signup, DCR, PKCE, authenticated tool discovery and `hello` | Passed; authenticated tool requests returned HTTP 200 |
| Missing requested scope | Rejected through the registered OAuth error redirect |
| Consent without browser binding / cross-origin submission | Rejected: HTTP 404 / 403 |
| Invalid token, wrong audience, missing tool scope | Rejected: HTTP 401 |
| Anonymous MCP initialization | HTTP 401 with OAuth challenge |
| Caller identity injection and second synthetic user | Passed; each invocation used its authenticated identity |
| First-party token presented to MCP | Rejected: HTTP 401 |
| Delegated OAuth token presented to first-party API | Rejected before first-party function authentication |
| Revoke existing grant, then reuse old access token | Rejected: HTTP 401 |
| Revoke existing grant, then reuse old refresh token | Rejected: HTTP 400 |
| Reconnect and invoke with newly issued token | Passed: HTTP 200 |
| Reconnect, then reuse pre-revocation access token | **Failed rejection check; Gateway audit shows the final invocation allowed** |

The final smoke line does not record the old token's HTTP status. A read-only audit inspection found two successive allowed `hello` calls for the same synthetic user in the runner's fixed order: newly issued token, then old token. There was no corresponding error record. This corroborates token revival after regrant; the audit does not store a token hash, so attribution relies on the sequential run rather than token-level correlation.

## Finding and containment

The stock proof resolver checks whether a grant exists **now**. Revocation removes that grant, so the old token initially fails. Reauthorizing the same client recreates a grant, and an old, still-unexpired signed token can satisfy the existence check again. The tested setup therefore lacks durable invalidation across reconnect. This is a limitation of the proof's stock grant-check design, not evidence that the entire planned production authorization layer was implemented.

Following the companion's stopping rule, set `MCP_PROOF_ENABLED=false` and confirmed the endpoint returns 503. Also revoked the actual ChatGPT-connected synthetic account's grant through the proof's disconnect control. The consent frontend remains available for inspection; a fresh MCP call will not work while disabled. No component fork, token-generation redesign or production integration was attempted.

## Next step

The compatibility uncertainty is resolved: **Convex Auth v2 + Codefox OAuth Provider + MCP Gateway can complete signup, OAuth and an authenticated tool call from ChatGPT.** Before integrating RoomScout, implement and narrowly verify the full plan's durable grant-generation/token invalidation boundary, so reconnect never reactivates revoked credentials. That is a separate step, not part of this completed experiment.

Real RoomScout profile/search tools, domain authorization, provider messaging, multi-user operation, embedded ChatGPT UI and public app submission remain unproven and outside this proof.
