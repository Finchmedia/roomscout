# Portal notifications: Resend → official AgentMail component

Status: receiver compatibility implemented; portal transport deployed to development and production. Scoped real notification E2E remains pending.
No migration test mail sent yet.

## Decision and scope

- Use the official `@agentmail/convex` component in the separate `roomscout-dev`
  portal. No custom transport, provider API wrapper, component fork or bespoke
  queue/webhook infrastructure.
- Preserve the existing band inboxes, their ownership and their incoming-mail
  processing. Give the portal one separate notification-sender inbox.
- Reuse `roomscout-dev/convex/emailTemplates.ts:newMessageEmail` unchanged:
  identical subject, HTML and plain text for identical inputs. Keep the existing
  `https://roomscout.dev/inbox/<threadId>` URL and all three X-RoomScout headers.
  Provider-generated envelope headers, message IDs and From necessarily differ.
- Keep conversations and message bodies in the authenticated portal. This is
  not a migration to conversations by email. Clerk verification mail is out of scope.
- The user accepts the official component's current retry ambiguity: v0.1.0
  does not send an HTTP Idempotency-Key, so an uncertain send followed by retry
  may duplicate a notification. Do not solve this through a custom transport.
  Retain the existing transactional per-message enqueue guard nonetheless.
- Delivery-delay status has no equivalent in this component version. Retain
  historical values; map new sent/delivered/bounced/complained/rejected/failed
  states accurately, never treat an enqueue as delivered.

## Sender inbox setup

- Use a dedicated AgentMail inbox as the portal notification sender.
- A provider-managed AgentMail domain is sufficient; no custom domain is required.
  Use the product's public display name.
- Metadata: not required; leave empty. Metadata is not a mail-routing header.
- Record the actual resulting inbox ID/address; do not assume the username was
  allocated. Use the ID as portal deployment configuration, not a band inbox.
- Configure the component API key and webhook signing secret on the portal's
  own Convex deployment. Configure the sender inbox ID as an application env var.
- Configure `AGENTMAIL_API_KEY` in each portal deployment, scoped to the
  notification inbox. This exact,
  case-sensitive name is the only API-key name the official component reads;
  it does not accept an `apiKey` constructor option. `AGENTMAIL_WEBHOOK_SECRET`
  and the sender-inbox webhooks must also be configured in each deployment.
- Point each deployment's sender-inbox webhook at its own
  `/agentmail/webhook` endpoint.
- Configure the portal webhook separately, scoped to this sender inbox where
  supported. Preserve RoomScout's existing receiver webhooks and signing secrets.
  Dashboard setup is acceptable; do not build a custom webhook-registration API.

## Critical compatibility finding

`roomscout/convex/portalNotifications.ts:consumeOwnedMailboxHint` previously
required a sender domain of `roomscout.dev`. It now also accepts the exact
configured notification-sender address, retaining exact subject/body markers
and one canonical portal conversation URL. Other AgentMail inboxes do not
qualify as portal notification senders.

Keep trust scoped to the exact portal sender address, not all of
`agentmail.to`. Keep current recipient/owner checks, canonical URL constraints,
duplicate coalescing and reviewed Browserbase connection selection.

The current URL is a recognition hint, NOT a Browserbase navigation argument.
Scout requests `portalInboxSync.requestSync`, and Browserbase uses the configured
`/inbox` route. Preserve this behavior rather than introduce arbitrary email-link
navigation. Prove the intended conversation reply is then imported and assessed.

## Execution with GPT-5.6-Sol subagents

The parent orchestrates integration, reviews the diff and verifies the end-to-end
result. Do not start these implementation tasks until executing this plan is requested.

### Sol A — portal component replacement

Own `roomscout-dev` package/config, `convex/email.ts`, `convex/http.ts`, notification
schema/status mapping and reset integration.

1. Install/register official component; use `AgentMail.sendMessage` from the
   existing enqueue mutation and persist its OutboundId atomically with the guard.
2. Pass existing template output and translate header array to the component's
   header map without changing header names or values.
3. Replace the Resend webhook with `handleWebhook` and an `onEvent` callback;
   correlate component/provider IDs to the portal message. Verify sent and terminal
   status propagation, including out-of-order/duplicate event handling.
4. Replace reset cancellation/status lookups with component methods. Never delete
   the portal sender or band inboxes as part of this migration.
5. Preserve old notification IDs as history; do not reinterpret Resend IDs as
   AgentMail IDs or resend historical notifications.

### Sol B — receiving-side compatibility

Own RoomScout `convex/portalNotifications.ts` and its integration tests.

1. Add the exact configured sender to the accepted notification senders.
2. Preserve the existing receiver webhook, mailbox-owner resolution, notification
   recognition and inbox-sync pipeline.
3. Test the unchanged portal template using the new sender, including CRLF handling.
4. Prove another AgentMail sender, wrong recipient, modified host/path, bulk
   recipient or duplicate delivery cannot trigger inappropriate or duplicate sync.
5. Do not change authentication, Browserbase contexts or registration behavior.

### Sol C — regression tests and cutover checklist

Own separate test files/docs, coordinating filenames with A/B before edits.

- Golden comparison of old/new template payload: subject/text/HTML and headers.
- Component send mock: exact recipient inbox, body and canonical conversation link.
- Duplicate enqueue, failed send, terminal event mapping and reset cancellation.
- No changes to existing band inbox assignments, source IDs or portal conversations.
- Verify component-version capabilities against the installed package before rollout.

## Rollout order

1. Confirm the sender inbox ID, credentials and independently scoped webhook.
2. Deploy/test receiver compatibility FIRST, before the portal starts using the new
   sender. Retain old sender acceptance during draining of already queued mail.
3. Freeze new Resend enqueueing for the cutover; drain or cancel pending Resend jobs.
   Never run both senders for the same portal message. No blanket historical replay.
4. Deploy portal component + new webhook/config, then switch new notifications.
   Keep only the legacy webhook/component needed to drain existing events temporarily.
5. Perform the real end-to-end test below. Remove legacy component/dependency/env
   references after pending work is settled and the test is confirmed.
6. Update portal README/setup instructions. No database wipe or account recreation.

## Implementation progress (2026-09-10)

- Installed and registered official `@agentmail/convex` v0.1.0; removed the
  Resend dependency and route from the portal source.
- New notifications enqueue from the configured dedicated sender inbox via
  `AGENTMAIL_NOTIFICATION_INBOX_ID`, preserve the existing template and exact
  X-RoomScout headers, and store provider differentiation plus the component
  OutboundId. Historical records without `notificationProvider: "agentmail"`
  are never cast to AgentMail IDs, canceled through AgentMail, or replayed.
- Mounted the official handler at `/agentmail/webhook`. Component status is
  mapped to queued/sent/delivered/bounced/complained/rejected/failed; historical
  Resend `delivery_delayed` remains valid history.
- Reset cancellation now targets only pending AgentMail component sends and
  never deletes the sender inbox or any band inbox.
- Development and production now run the official component. Before production
  cutover, historical portal notifications were checked for pending work; no
  historical notification was replayed. The scoped real notification acceptance
  test remains to be completed with a designated test account and an existing
  provider conversation.

## Required real end-to-end acceptance test

Use one explicitly designated test account and an existing provider conversation.
Send one clearly identifiable reply from the portal UI.

1. Portal saves the reply and queues exactly one new notification record.
2. Official AgentMail component sends from the dedicated portal sender to the
   existing, correct band inbox; record send/delivery evidence.
3. Compare the received text/HTML/link to the unchanged template. Check actual
   delivery, not just the portal's queued/sent status.
4. Existing band-inbox webhook receives the email; recognition accepts the exact
   new sender and schedules the existing portal inbox sync without a manual button.
5. Browserbase uses the correct band's existing connection/context, opens the
   portal inbox and imports the intended reply. No unintended signup/new account.
6. Scout assesses the reply and the UI updates consistently with stored messages
   and the current offer. No binding acceptance or automatic test commitment.
7. Re-delivery of the same event coalesces; unrelated sender tests are isolated
   automated tests, not real spam to users.

Done means this entire chain is observed. Merely receiving mail in the AgentMail
dashboard, or a green unit test suite, is insufficient.

## Recovery

On failure, stop new enqueueing while investigating; do not immediately replay an
uncertain send. Keep band inboxes/portal conversations intact. If reverting the
transport, account for pending AgentMail work first and restore the prior sender
configuration without sending the same portal message through both providers.

## References

- Official component: https://github.com/agentmail-to/convex
- AgentMail send idempotency: https://docs.agentmail.to/idempotency
- AgentMail events: https://docs.agentmail.to/events
- Custom sender domains (optional later): https://docs.agentmail.to/custom-domains
