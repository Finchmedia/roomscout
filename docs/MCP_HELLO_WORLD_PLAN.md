# Isolated MCP / OAuth hello-world proof

2026-09-19 · Isolated proof implemented; see [execution results](MCP_HELLO_WORLD_RESULTS.md).

## Goal and relationship to the main plan

Prove that **ChatGPT can connect through Codefox OAuth Provider to Convex MCP Gateway, using the same Convex Auth v2 setup as RoomScout, and call one authenticated hello-world tool**.

This is the bounded execution plan for **Phase 0** of [MCP_IMPLEMENTATION_PLAN.md](MCP_IMPLEMENTATION_PLAN.md). The main document remains the roadmap for the full feature. Its domain tools, production hardening and later phases are not part of this experiment.

**Stop after the proof and a findings report. Do not automatically integrate anything into existing RoomScout deployments or proceed to Phase 1.** A measured incompatibility is a valid result; it does not authorize a broader implementation.

## 1. Fixed scope

Build only:

- One minimal standalone project in a separate workspace directory, with its own package manifest, lockfile, Convex configuration and ignored environment file.
- One new Convex deployment with a public HTTPS URL, explicitly separate from RoomScout's existing dev and production deployments.
- The existing Auth v2 username/password approach, minimal user callbacks and synthetic test accounts. Support account creation inside the OAuth flow, then resume consent directly. Copy only the necessary auth setup, not the application backend.
- Codefox OAuth Provider and MCP Gateway, with a minimal signup/sign-in/consent page and one small disconnect control for the experiment.
- One authenticated MCP tool, `hello`, returning `Hello from RoomScout` and the signed-in synthetic user's label. No user ID or identity input is accepted from the caller.
- A redacted result report and the isolated source needed to reproduce the proof.

**Excluded:** room listings, onboarding, search/matching, real RoomScout accounts/data, provider conversations, AgentMail, Firecrawl, webhooks, background agents, Workpools, crons, voice, embedded ChatGPT cards, app-store submission and production connected-app settings. No existing deployment keys, auth keys, sessions or database exports are copied.

Start with the versions already inspected: Convex `1.45.0`, Auth `2.0.0-alpha.1`, Codefox `0.4.2`, Gateway `2.0.0`. Use the existing React/Vite and Convex Static Hosting approach for the tiny login/consent frontend. Record exact installed versions; any required version change must be explained in the result.

## 2. Isolation and authorization boundary

Before any future deployment action, record the new deployment's identifier, URL and expiry/cleanup arrangement. Use a deployment-scoped key and verify the resolved target before environment changes or deployment. Run commands only from the isolated project. Do not change the main checkout's deployment selection, environment files, dependencies or lockfile.

Generate fresh Auth v2 and separate OAuth signing keys. The frontend, consent routes and OAuth metadata all point to the new deployment. Source alone is insufficient: these keys and URLs need their own sandbox configuration.

Keep the first-party `auth.config.ts` trust pattern unchanged, using the sandbox's own Auth v2 issuer and `convex` application ID. **Do not add the Codefox issuer to global Convex authentication.** The experiment must establish whether its bearer reaches the gateway's custom identity resolver.

The resolver verifies the access token's signature, issuer, exact audience, expiry and scope, and uses Codefox's existing authorization-existence check. This stock check is not the production token-hash/generation lookup proposed in the main plan; reconnect may expose its known limitation. Use one probe scope, `roomscout:hello`, and the gateway's hidden `identityArg` to pass verified identity to an internal handler. The handler resolves an existing synthetic user server-side. Neither a caller-supplied identity nor a first-party login token is a delegated MCP credential.

Use the stock components first. Thin host wiring, explicit metadata aliases and ordinary bug fixes in the experiment's own code are in scope. **Component forks/patches, the main plan's grant-generation redesign, an alternate auth stack and an external proxy are out of scope.** If any is required, record the blocker and stop.

## 3. Minimal connection flow

Let `SITE` be the new deployment's public site origin:

| Purpose | Address |
| --- | --- |
| Canonical MCP resource and token audience | `SITE/api/mcp` |
| Codefox issuer | `SITE/api/oauth` |
| Codefox signing keys | `SITE/api/oauth/.well-known/jwks.json` |
| Authorization-server discovery | `SITE/.well-known/oauth-authorization-server/api/oauth` |
| Protected-resource discovery | `SITE/.well-known/oauth-protected-resource/api/mcp` |
| Minimal first-party consent page | `SITE/connect/authorize` |

Register explicit routes before static hosting. Codefox owns authorization/token/client-registration endpoints; the gateway owns MCP. Do not enable the gateway's separate OAuth bridge. Avoid conflicting discovery metadata: Codefox's root-registration flag does not remove its prefix-local metadata routes.

Flow: **ChatGPT connects → discovery and client registration as required → Auth v2 signup or sign-in → consent for hello access → S256 PKCE code exchange → authenticated `hello` call.** No existing RoomScout account or manual band-profile questionnaire is required. A later scoped profile tool can accept confirmed band details from the user's agent; that tool is outside this hello proof.

Use Codefox's redirect, resource and PKCE validation. Bind the consent continuation to the initiating browser and authenticated user, keep its parameters server-side, expire and consume it once, and apply same-origin/CSRF protection. A minimal UI still needs this boundary. Client state does not replace local CSRF protection, and the browser cannot substitute the redirect or requested permissions.

Request refresh capability only if it is part of the tested connection. Configure private MCP mode, authorization challenges and the actual client's registration method. Do not replace the real ChatGPT flow with a manually supplied token and call that success.

## 4. Execution order

1. **Prepare the isolated project and deployment.** Verify versions and deployment targeting. Seed only synthetic test users; confirm ordinary Auth v2 sign-in works.
2. **Wire OAuth and the single tool.** Use internal function references, argument/return validators, bounded indexed user/grant lookups and server-only secrets. Keep raw tokens out of logs and result files.
3. **Probe the bearer boundary early.** A genuine Codefox access token must reach the custom resolver despite its issuer being absent from `auth.config.ts`. The same token must fail against a small authenticated first-party function in this sandbox. If this boundary fails, stop before polishing the UI.
4. **Connect from ChatGPT.** Complete the actual login/consent exchange and invoke `hello`. MCP Inspector or an HTTP client may diagnose failures but do not replace this acceptance step.
5. **Run the small checks below, write the report, and stop.** If the user's ChatGPT account/browser interaction is needed, ask for that specific connection step and mark it pending until performed.

## 5. Functional checks only

Use a small script or focused test file plus one manual target-client flow. No full RoomScout suite, broad protocol suite, load testing or benchmark work.

| Check | Expected observation |
| --- | --- |
| Actual ChatGPT connection | Discovery, login, consent and PKCE exchange complete; ChatGPT calls `hello` and displays the test user's greeting |
| Caller identity | A second synthetic account gets its own label; a supplied identity argument cannot change the authenticated caller |
| Authorization failures | Missing/invalid token, wrong audience and missing hello scope fail; the delegated token also fails against the sandbox's first-party authenticated function |
| Disconnect baseline | After server-side grant revocation, the previously issued access token fails; its refresh credential fails too if one was issued |
| Reconnect baseline | A new connection/token works; credentials retained from before revocation remain rejected |

The last two checks **observe stock-component behavior**. They do not authorize implementing the main plan's revocation patch or exploring every issuance race. Any token used for these checks stays in the test harness's memory or a protected temporary secret file, never the report or shell output.

Disconnect means invoking server-side revocation through the test control, not merely removing the connector in ChatGPT. Record the actual HTTP/protocol outcome for each check. Run the standalone project's typecheck/build; repeat only after a relevant change or failure.

## 6. Result and stop condition

Report these dimensions separately:

- **Target-client flow proven:** ChatGPT completed the flow and the authenticated hello tool worked. This alone does not establish correct authorization.
- **Authorization observations:** Which negative, disconnect and reconnect checks passed or failed. Accepted wrong audiences/scopes, identity spoofing or access to ordinary first-party APIs mean **“Target-client flow proven; integration blocked by authorization isolation.”** Unsafe revocation uses the subtype **“integration blocked by revocation.”** Only report compatibility with the intended boundary when its checks pass. The known main-plan hardening remains outstanding even if these simple checks pass.
- **Compatibility blocked:** Record the exact failing boundary and smallest proposed next step. Do not quietly weaken validation or switch architecture to obtain a green result.
- **Target-client check pending:** Local/Inspector success alone is not ChatGPT compatibility proof.

Deliver the isolated source location, deployment/consent/MCP URLs, exact versions, redacted check results and one short recommendation for the next step. Clearly state that this proves neither RoomScout's real tool authorization nor its provider workflow.

Leave a successful synthetic demo available for review for its recorded lifetime. If a security check fails, disable further connector access after capturing the evidence. Eventual cleanup targets only resources created for this experiment; preserve the report/source and never touch existing RoomScout environments.

**Completion is the report.** No merge, existing dev/prod deployment, domain-tool work, production hardening or continuation into Phase 1 follows without a separate user instruction.

## References

- [Full MCP plan and audited component details](MCP_IMPLEMENTATION_PLAN.md).
- [Convex multiple deployments and deployment-scoped keys](https://docs.convex.dev/production/multiple-deployments).
- [Codefox component skill](https://www.convex.dev/components/codefox-inc/oauth-provider/SKILL.md) and [MCP Gateway component skill](https://www.convex.dev/components/convex-mcp-gateway/SKILL.md); read the pinned-version guidance before implementation.
